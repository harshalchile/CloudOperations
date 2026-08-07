import time
import threading
import boto3
from flask import request
from flask_jwt_extended import decode_token
from models.user import User
from services.aws_service import get_target_aws_accounts
from services.terminal_service import (
    generate_ephemeral_rsa_keypair,
    send_ec2_instance_connect_key,
    connect_paramiko_ssh
)

# Store active sessions in memory per socket sid
# active_sessions[sid] = {'ssh_client': client, 'channel': channel, 'running': True, 'thread': thread}
active_sessions = {}

def register_socket_events(socketio):

    @socketio.on('start_ssh')
    def handle_start_ssh(data):
        sid = request.sid
        token = data.get('token')
        instance_id = data.get('instance_id')
        username = data.get('username') or 'ec2-user'
        custom_pem = data.get('pem_key')
        cols = data.get('cols', 80)
        rows = data.get('rows', 24)

        if not token or not instance_id:
            socketio.emit('ssh_error', {'error': 'Authentication token and instance_id are required.'}, room=sid)
            return

        # Clean up any existing session for this socket
        close_session(sid)

        # Step 1: Authenticating...
        socketio.emit('ssh_status', {'message': 'Authenticating...'}, room=sid)

        try:
            decoded = decode_token(token)
            user_id = decoded['sub']
            user = User.query.get(user_id)
            if not user:
                socketio.emit('ssh_error', {'error': 'Invalid user session.'}, room=sid)
                return
        except Exception as e:
            socketio.emit('ssh_error', {'error': f'Authentication failed: {str(e)}'}, room=sid)
            return

        # Step 2: Push ephemeral SSH public key or prepare custom key
        try:
            if custom_pem and custom_pem.strip():
                pem_key_str = custom_pem.strip()
                accounts = get_target_aws_accounts(user)
                if not accounts:
                    socketio.emit('ssh_error', {'error': 'No connected AWS accounts.'}, room=sid)
                    return
                
                host_ip = None
                for acc in accounts:
                    try:
                        ec2_client = boto3.client(
                            'ec2',
                            aws_access_key_id=acc.get_decrypted_access_key(),
                            aws_secret_access_key=acc.get_decrypted_secret_key(),
                            region_name=acc.region or 'us-east-1'
                        )
                        res = ec2_client.describe_instances(InstanceIds=[instance_id])
                        inst = res['Reservations'][0]['Instances'][0]
                        host_ip = inst.get('PublicIpAddress')
                        if host_ip:
                            break
                    except Exception:
                        continue

                if not host_ip:
                    socketio.emit('ssh_error', {'error': f'Instance {instance_id} does not have a public IP address or was not found in connected AWS accounts.'}, room=sid)
                    return
            else:
                socketio.emit('ssh_status', {'message': 'Sending SSH public key via AWS EC2 Instance Connect...'}, room=sid)
                private_pem, public_ssh = generate_ephemeral_rsa_keypair()
                host_ip, inst = send_ec2_instance_connect_key(user, instance_id, public_ssh, username=username)
                pem_key_str = private_pem

            # Step 3: Connecting...
            socketio.emit('ssh_status', {'message': f'Establishing SSH connection to {host_ip}:22 as {username}...'}, room=sid)
            ssh_client, channel = connect_paramiko_ssh(host_ip, username, pem_key_str, cols=cols, rows=rows)

            # Save session state
            session_data = {
                'ssh_client': ssh_client,
                'channel': channel,
                'running': True,
                'sid': sid
            }
            active_sessions[sid] = session_data

            # Step 4: Connected.
            socketio.emit('ssh_status', {'message': 'Connected.'}, room=sid)
            socketio.emit('ssh_connected', {
                'message': 'Connected.',
                'host_ip': host_ip,
                'username': username,
                'instance_id': instance_id
            }, room=sid)

            # Start background reader thread
            thread = socketio.start_background_task(target=stream_terminal_output, sid=sid, socketio=socketio)
            session_data['thread'] = thread

        except Exception as e:
            socketio.emit('ssh_error', {'error': str(e)}, room=sid)

    @socketio.on('terminal_input')
    def handle_terminal_input(data):
        sid = request.sid
        session = active_sessions.get(sid)
        if session and session.get('channel'):
            try:
                input_str = data.get('data', '')
                session['channel'].send(input_str)
            except Exception as e:
                socketio.emit('ssh_error', {'error': f'Write error: {str(e)}'}, room=sid)

    @socketio.on('terminal_resize')
    def handle_terminal_resize(data):
        sid = request.sid
        session = active_sessions.get(sid)
        if session and session.get('channel'):
            cols = data.get('cols', 80)
            rows = data.get('rows', 24)
            try:
                session['channel'].resize_pty(width=cols, height=rows)
            except Exception:
                pass

    @socketio.on('disconnect_ssh')
    def handle_disconnect_ssh(data):
        close_session(request.sid)
        socketio.emit('ssh_status', {'message': 'Disconnected.'}, room=request.sid)

    @socketio.on('ping_check')
    def handle_ping_check(data):
        socketio.emit('pong_check', {'time': time.time(), 'client_time': data.get('time')}, room=request.sid)

    @socketio.on('disconnect')
    def handle_disconnect():
        close_session(request.sid)


def stream_terminal_output(sid, socketio):
    """Background loop streaming Paramiko channel output to SocketIO."""
    session = active_sessions.get(sid)
    if not session:
        return

    channel = session['channel']
    while session.get('running') and not channel.closed:
        try:
            if channel.recv_ready():
                data = channel.recv(4096)
                if data:
                    text = data.decode('utf-8', errors='replace')
                    socketio.emit('terminal_output', {'data': text}, room=sid)
                else:
                    break
            elif channel.recv_stderr_ready():
                data = channel.recv_stderr(4096)
                if data:
                    text = data.decode('utf-8', errors='replace')
                    socketio.emit('terminal_output', {'data': text}, room=sid)
                else:
                    break
            else:
                time.sleep(0.02)
        except Exception:
            break

    close_session(sid)


def close_session(sid):
    session = active_sessions.pop(sid, None)
    if session:
        session['running'] = False
        try:
            if session.get('channel'):
                session['channel'].close()
        except Exception:
            pass
        try:
            if session.get('ssh_client'):
                session['ssh_client'].close()
        except Exception:
            pass

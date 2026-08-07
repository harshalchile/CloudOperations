import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Typography,
} from '@mui/material';

const ec2InstancesData = [
  {
    id: 'i-0a8b9c1d2e3f4a5b6',
    name: 'web-server-prod-01',
    type: 't3.medium',
    zone: 'us-east-1a',
    ip: '54.210.12.44',
    state: 'Running',
  },
  {
    id: 'i-0f9e8d7c6b5a4f3e2',
    name: 'api-gateway-node-02',
    type: 't3.large',
    zone: 'us-east-1b',
    ip: '34.192.88.101',
    state: 'Running',
  },
  {
    id: 'i-0123456789abcdef0',
    name: 'db-replica-postgres',
    type: 'r5.xlarge',
    zone: 'us-east-1c',
    ip: '10.0.3.150',
    state: 'Running',
  },
  {
    id: 'i-076543210fedcba98',
    name: 'analytics-worker-dev',
    type: 'c5.large',
    zone: 'us-east-1a',
    ip: '52.90.114.22',
    state: 'Stopped',
  },
];

export const EC2Table = ({ onActionClick }) => {
  return (
    <TableContainer>
      <Table sx={{ minWidth: 650 }} size="small" aria-label="EC2 instances table">
        <TableHead sx={{ bgcolor: '#F9FAFB' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>INSTANCE ID</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>NAME</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>TYPE</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>ZONE</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>IP ADDRESS</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>STATE</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>ACTIONS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {ec2InstancesData.map((row) => (
            <TableRow key={row.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
              <TableCell component="th" scope="row">
                <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}>
                  {row.id}
                </Typography>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>{row.name}</TableCell>
              <TableCell>
                <Chip label={row.type} size="small" variant="outlined" sx={{ fontSize: '0.725rem', height: 22 }} />
              </TableCell>
              <TableCell>{row.zone}</TableCell>
              <TableCell>{row.ip}</TableCell>
              <TableCell>
                <Chip
                  label={row.state}
                  size="small"
                  color={row.state === 'Running' ? 'success' : 'default'}
                  sx={{ fontWeight: 600, fontSize: '0.725rem', height: 22 }}
                />
              </TableCell>
              <TableCell>
                {row.state === 'Running' ? (
                  <>
                    <Button size="small" sx={{ mr: 1, minWidth: 48, fontSize: '0.75rem' }} onClick={() => onActionClick && onActionClick('Stop', row.id)}>
                      Stop
                    </Button>
                    <Button size="small" color="inherit" sx={{ minWidth: 48, fontSize: '0.75rem' }} onClick={() => onActionClick && onActionClick('Reboot', row.id)}>
                      Reboot
                    </Button>
                  </>
                ) : (
                  <Button size="small" variant="contained" sx={{ fontSize: '0.75rem' }} onClick={() => onActionClick && onActionClick('Start', row.id)}>
                    Start
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

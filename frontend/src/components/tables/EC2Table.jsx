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

export const EC2Table = ({ instances = [], onActionClick }) => {
  return (
    <TableContainer>
      <Table sx={{ minWidth: 650 }} size="small" aria-label="EC2 instances table">
        <TableHead sx={{ bgcolor: '#F9FAFB' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>INSTANCE ID</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>NAME</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>ACCOUNT</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>TYPE</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>REGION</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>IP ADDRESS</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>STATE</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>ACTIONS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {instances.map((row) => {
            const instId = row.instance_id || row.id;
            const instName = row.name || 'Unnamed Server';
            const accInfo = row.aws_account_name || row.account_name ? `${row.aws_account_name || row.account_name} (${row.aws_account_number || row.account_id || ''})` : 'N/A';
            const instType = row.instance_type || row.type;
            const ipAddr = row.public_ip || row.ip || 'N/A';
            const stateStr = row.status || row.state || 'unknown';

            return (
              <TableRow key={instId} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                <TableCell component="th" scope="row">
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'primary.main', fontWeight: 600 }}>
                    {instId}
                  </Typography>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>{instName}</TableCell>
                <TableCell sx={{ fontSize: '0.75rem' }}>{accInfo}</TableCell>
                <TableCell>
                  <Chip label={instType} size="small" variant="outlined" sx={{ fontSize: '0.725rem', height: 22 }} />
                </TableCell>
                <TableCell>{row.region || 'ap-south-1'}</TableCell>
                <TableCell>{ipAddr}</TableCell>
                <TableCell>
                  <Chip
                    label={stateStr}
                    size="small"
                    color={stateStr.toLowerCase() === 'running' ? 'success' : 'default'}
                    sx={{ fontWeight: 600, fontSize: '0.725rem', height: 22 }}
                  />
                </TableCell>
                <TableCell>
                  {stateStr.toLowerCase() === 'running' ? (
                    <>
                      <Button size="small" sx={{ mr: 1, minWidth: 48, fontSize: '0.75rem' }} onClick={() => onActionClick && onActionClick('Stop', instId)}>
                        Stop
                      </Button>
                      <Button size="small" color="inherit" sx={{ minWidth: 48, fontSize: '0.75rem' }} onClick={() => onActionClick && onActionClick('Reboot', instId)}>
                        Reboot
                      </Button>
                    </>
                  ) : (
                    <Button size="small" variant="contained" sx={{ fontSize: '0.75rem' }} onClick={() => onActionClick && onActionClick('Start', instId)}>
                      Start
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
};


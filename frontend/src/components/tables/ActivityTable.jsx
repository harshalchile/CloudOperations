import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Typography,
} from '@mui/material';

const activityData = [
  { time: '2026-08-05 19:42:10', event: 'ec2:StartInstances', resource: 'i-0a8b9c1d2e3f4a5b6', user: 'harsh.admin@cloudops.internal', region: 'us-east-1', status: 'Success' },
  { time: '2026-08-05 18:15:30', event: 's3:PutBucketPolicy', resource: 'prod-logs-bucket-01', user: 'harsh.admin@cloudops.internal', region: 'us-east-1', status: 'Success' },
  { time: '2026-08-05 17:04:12', event: 'cloudwatch:PutMetricAlarm', resource: 'HighCPUUtilization-WebServer01', user: 'cloudwatch-auto-scaler', region: 'us-east-1', status: 'Success' },
  { time: '2026-08-05 15:22:05', event: 'ec2:TerminateInstances', resource: 'i-054321abcdef6789', user: 'ci-cd-pipeline-service', region: 'us-east-1', status: 'Success' },
];

export const ActivityTable = () => {
  return (
    <TableContainer>
      <Table sx={{ minWidth: 650 }} size="small">
        <TableHead sx={{ bgcolor: '#F9FAFB' }}>
          <TableRow>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>TIMESTAMP</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>EVENT NAME</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>TARGET RESOURCE</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>USER / IDENTITY</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>REGION</TableCell>
            <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem', color: 'text.secondary' }}>STATUS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {activityData.map((row, i) => (
            <TableRow key={i} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
              <TableCell>{row.time}</TableCell>
              <TableCell>
                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: 'primary.main' }}>
                  {row.event}
                </Typography>
              </TableCell>
              <TableCell>{row.resource}</TableCell>
              <TableCell>{row.user}</TableCell>
              <TableCell>{row.region}</TableCell>
              <TableCell>
                <Chip label={row.status} size="small" color="success" sx={{ fontWeight: 600, fontSize: '0.725rem', height: 22 }} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

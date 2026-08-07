import React from 'react';
import { Box, Typography, LinearProgress } from '@mui/material';

const storageClasses = [
  { name: 'Standard Storage', size: '920 GB', percentage: 64.7, color: 'primary' },
  { name: 'Glacier Flexible Archive', size: '340 GB', percentage: 23.9, color: 'secondary' },
  { name: 'Intelligent-Tiering', size: '160 GB', percentage: 11.4, color: 'success' },
];

export const StorageChart = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
      {storageClasses.map((item) => (
        <Box key={item.name}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {item.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
              {item.size} ({item.percentage}%)
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={item.percentage}
            color={item.color}
            sx={{ height: 8, borderRadius: 4, bgcolor: '#E5E7EB' }}
          />
        </Box>
      ))}
    </Box>
  );
};

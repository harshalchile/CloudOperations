import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

export const LoadingSpinner = ({ label = 'Loading Cloud Operations...' }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
        gap: 2,
      }}
    >
      <CircularProgress color="primary" size={40} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
};

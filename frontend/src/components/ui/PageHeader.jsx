import React from 'react';
import { Box, Typography } from '@mui/material';
import { Breadcrumb } from '../layout/Breadcrumb';

export const PageHeader = ({ title, subtitle, action }) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Breadcrumb />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mt: 1 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, color: 'text.primary' }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && <Box>{action}</Box>}
      </Box>
    </Box>
  );
};

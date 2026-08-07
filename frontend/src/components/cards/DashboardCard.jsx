import React from 'react';
import { Card, CardHeader, CardContent, Typography, Box } from '@mui/material';

export const DashboardCard = ({ title, icon: Icon, action, children }) => {
  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {title && (
        <CardHeader
          title={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {Icon && <Icon style={{ color: '#2563EB' }} />}
              <Typography variant="h6" sx={{ fontSize: '1.05rem', fontWeight: 600 }}>
                {title}
              </Typography>
            </Box>
          }
          action={action}
          sx={{ pb: 1, pt: 2.5, px: 3 }}
        />
      )}
      <CardContent sx={{ flexGrow: 1, p: 3, pt: title ? 1 : 3, '&:last-child': { pb: 3 } }}>
        {children}
      </CardContent>
    </Card>
  );
};

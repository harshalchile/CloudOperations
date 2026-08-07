import React, { useState } from 'react';
import { IconButton, Badge, Menu, MenuItem, Typography, Box } from '@mui/material';
import { FiBell } from 'react-icons/fi';

export const NotificationMenu = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  return (
    <Box>
      <IconButton onClick={handleClick} color="inherit" size="medium">
        <Badge badgeContent={3} color="error">
          <FiBell style={{ color: '#4B5563' }} />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ sx: { width: 300, mt: 1, p: 1 } }}
      >
        <Typography variant="subtitle2" sx={{ px: 1, py: 0.5, fontWeight: 700 }}>
          Notifications
        </Typography>
        <MenuItem onClick={handleClose}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
              CloudWatch Alarm Triggered
            </Typography>
            <Typography variant="caption" color="text.secondary">
              HighCPUUtilization-WebServer01 &gt; 85%
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              S3 Bucket Created
            </Typography>
            <Typography variant="caption" color="text.secondary">
              cloudops-app-static-assets-prod
            </Typography>
          </Box>
        </MenuItem>
        <MenuItem onClick={handleClose}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              EC2 Instance Stopped
            </Typography>
            <Typography variant="caption" color="text.secondary">
              analytics-worker-dev (i-07654321)
            </Typography>
          </Box>
        </MenuItem>
      </Menu>
    </Box>
  );
};

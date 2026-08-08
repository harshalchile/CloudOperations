import React, { useState } from 'react';
import { Box, Avatar, Typography, Menu, MenuItem, Divider, IconButton } from '@mui/material';
import { FiUser, FiSettings, FiLogOut, FiChevronDown } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export const ProfileMenu = () => {
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const { user, avatarInitial, logout } = useAuth();
  const open = Boolean(anchorEl);

  const handleClick = (event) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleNavigate = (path) => {
    handleClose();
    navigate(path);
  };

  const handleLogout = async () => {
    handleClose();
    await logout();
    navigate('/login');
  };

  return (
    <Box>
      <IconButton
        onClick={handleClick}
        size="small"
        sx={{ borderRadius: 2, px: 1, gap: 1 }}
        aria-controls={open ? 'profile-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : undefined}
      >
        <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: '0.875rem', fontWeight: 700 }}>
          {avatarInitial || 'U'}
        </Avatar>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', alignItems: 'flex-start' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }}>
            {user?.name || 'User'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.725rem' }}>
            Cloud Engineer
          </Typography>
        </Box>
        <FiChevronDown style={{ color: '#6B7280', fontSize: '0.8rem' }} />
      </IconButton>

      <Menu
        id="profile-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: { width: 220, mt: 1, p: 0.5, boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' },
        }}
      >
        <Box sx={{ px: 2, py: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {user?.name || 'User'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {user?.email || ''}
          </Typography>
        </Box>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => handleNavigate('/profile')}>
          <FiUser style={{ marginRight: 10 }} /> Profile Details
        </MenuItem>
        <MenuItem onClick={() => handleNavigate('/settings')}>
          <FiSettings style={{ marginRight: 10 }} /> System Preferences
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={handleLogout} sx={{ color: 'error.main' }}>
          <FiLogOut style={{ marginRight: 10 }} /> Sign Out
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default ProfileMenu;

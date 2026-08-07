import React from 'react';
import { Paper, InputBase } from '@mui/material';
import { FiSearch } from 'react-icons/fi';

export const SearchBar = ({ placeholder = 'Search resources, EC2, S3, alarms...' }) => {
  return (
    <Paper
      component="form"
      onSubmit={(e) => e.preventDefault()}
      sx={{
        p: '2px 8px',
        display: 'flex',
        alignItems: 'center',
        width: { xs: 180, sm: 300, md: 360 },
        bgcolor: '#F3F4F6',
        boxShadow: 'none',
        border: '1px solid transparent',
        '&:focus-within': {
          bgcolor: '#FFFFFF',
          borderColor: 'primary.main',
          boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)',
        },
      }}
    >
      <FiSearch style={{ margin: '0 8px', color: '#6B7280' }} />
      <InputBase
        sx={{ ml: 1, flex: 1, fontSize: '0.875rem' }}
        placeholder={placeholder}
        inputProps={{ 'aria-label': 'search cloud resources' }}
      />
    </Paper>
  );
};

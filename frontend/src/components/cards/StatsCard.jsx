import React from 'react';
import { Card, CardContent, Box, Typography, LinearProgress, Chip } from '@mui/material';
import { motion } from 'framer-motion';

export const StatsCard = ({ title, value, icon: Icon, color = 'primary', subtext, progress, badge }) => {
  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
      <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
              {title}
            </Typography>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.2rem',
                bgcolor: `${color}.light`,
                color: `${color}.main`,
                opacity: 0.9,
              }}
            >
              {Icon && <Icon />}
            </Box>
          </Box>

          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5, color: 'text.primary' }}>
            {value}
          </Typography>

          {progress !== undefined && (
            <Box sx={{ mt: 1.5, mb: 1 }}>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{ height: 6, borderRadius: 3, bgcolor: '#E5E7EB' }}
              />
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            {badge && (
              <Chip
                label={badge.text}
                size="small"
                color={badge.type || 'success'}
                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 700 }}
              />
            )}
            {subtext && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.775rem' }}>
                {subtext}
              </Typography>
            )}
          </Box>
        </CardContent>
      </Card>
    </motion.div>
  );
};

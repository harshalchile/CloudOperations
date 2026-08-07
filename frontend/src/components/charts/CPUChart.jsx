import React, { useState } from 'react';
import { Box, ButtonGroup, Button, useTheme } from '@mui/material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const data24h = [
  { time: '00:00', cpu: 28, network: 12 },
  { time: '04:00', cpu: 34, network: 18 },
  { time: '08:00', cpu: 62, network: 45 },
  { time: '12:00', cpu: 78, network: 80 },
  { time: '16:00', cpu: 54, network: 50 },
  { time: '20:00', cpu: 42, network: 30 },
  { time: 'Now', cpu: 45, network: 35 },
];

export const CPUChart = () => {
  const [timeRange, setTimeRange] = useState('24H');
  const theme = useTheme();

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <ButtonGroup size="small" variant="outlined" aria-label="time range buttons">
          {['1H', '24H', '7D', '30D'].map((range) => (
            <Button
              key={range}
              onClick={() => setTimeRange(range)}
              variant={timeRange === range ? 'contained' : 'outlined'}
              sx={{ px: 1.5, py: 0.25, fontSize: '0.75rem', fontWeight: 600 }}
            >
              {range}
            </Button>
          ))}
        </ButtonGroup>
      </Box>

      <Box sx={{ height: 260, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data24h} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.4} />
                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis dataKey="time" tick={{ fontSize: 12, fill: '#6B7280' }} />
            <YAxis tick={{ fontSize: 12, fill: '#6B7280' }} domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                border: '1px solid #E5E7EB',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
              }}
            />
            <Area
              type="monotone"
              dataKey="cpu"
              stroke={theme.palette.primary.main}
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorCpu)"
              name="CPU Utilization (%)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

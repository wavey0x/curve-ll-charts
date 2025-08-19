import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const APRChart = ({ data, title, height = 400 }) => {
  // Protocol mapping for icons
  const protocolIcons = {
    asdCRV: {
      name: 'asdCRV',
      iconUrl:
        'https://assets.coingecko.com/coins/images/13724/standard/stakedao_logo.jpg?1696513468',
    },
    yvyCRV: {
      name: 'yvyCRV',
      iconUrl:
        'https://assets.coingecko.com/coins/images/11849/standard/yearn.jpg?1696511720',
    },
    ucvxCRV: {
      name: 'ucvxCRV',
      iconUrl:
        'https://assets.coingecko.com/coins/images/15585/standard/convex.png?1696515221',
    },
  };

  // Helper function to position icons at the end of their respective lines
  const calculateIconPosition = (cx, cy, dataKey) => {
    if (!data || data.length === 0) return { x: cx - 9, y: cy - 9 };

    const lastPoint = data[data.length - 1];
    
    // Check if this protocol has data at the last point
    const hasValue = lastPoint[dataKey] !== null && lastPoint[dataKey] !== undefined;
    if (!hasValue) return { x: cx - 9, y: cy - 9 };

    // Get all protocols with values at the last point and sort by value
    const finalValues = Object.keys(protocolIcons)
      .map(key => ({
        key,
        value: lastPoint[key],
        hasValue: lastPoint[key] !== null && lastPoint[key] !== undefined
      }))
      .filter(item => item.hasValue)
      .sort((a, b) => b.value - a.value);

    const currentIndex = finalValues.findIndex(item => item.key === dataKey);
    if (currentIndex === -1) return { x: cx - 9, y: cy - 9 };

    // Position icon at the line endpoint, with slight vertical stacking if values are very close
    let adjustedY = cy - 9;
    
    // If multiple protocols have very similar values, stack them vertically slightly
    if (currentIndex > 0) {
      const currentValue = finalValues[currentIndex].value;
      const previousValue = finalValues[currentIndex - 1].value;
      const valueDiff = Math.abs(currentValue - previousValue);
      
      // If values are very close (within 0.3%), stack vertically
      if (valueDiff < 0.3) {
        adjustedY = cy - 9 + (currentIndex * 8); // Stack downward
      }
    }

    return { x: cx - 9, y: adjustedY };
  };

  // Custom dot component for final points
  const CustomDot = ({ cx, cy, payload, dataKey }) => {
    const protocol = protocolIcons[dataKey];
    const isLastPoint = payload && data && payload === data[data.length - 1];

    if (!isLastPoint || !protocol) {
      return null;
    }

    const { x, y } = calculateIconPosition(cx, cy, dataKey);

    return (
      <foreignObject x={x} y={y} width={18} height={18}>
        <img
          src={protocol.iconUrl}
          alt={protocol.name}
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            border: '1px solid white',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.2)',
            display: 'block',
            margin: '1px',
            objectFit: 'cover',
          }}
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      </foreignObject>
    );
  };

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div
          className="custom-tooltip"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.98)',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            fontSize: '13px',
            backdropFilter: 'blur(8px)',
          }}
        >
          <p
            style={{
              margin: '0 0 8px 0',
              fontWeight: '600',
              color: '#333',
              fontSize: '14px',
            }}
          >
            {new Date(label).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
          {payload
            .sort((a, b) => b.value - a.value) // Sort by value, largest first
            .map((entry, index) => (
              <p
                key={index}
                style={{
                  margin: '4px 0',
                  color: entry.color,
                  fontWeight: '500',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{entry.name}</span>
                <span style={{ fontWeight: '600', marginLeft: '12px' }}>
                  {entry.value.toFixed(2)}%
                </span>
              </p>
            ))}
        </div>
      );
    }
    return null;
  };

  // Custom legend component
  const CustomLegend = ({ payload }) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '32px',
        marginTop: '20px',
        flexWrap: 'wrap',
      }}
    >
      {payload.map((entry, index) => {
        const protocol = protocolIcons[entry.dataKey];
        return (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: '500',
              opacity: 0.8,
            }}
          >
            <div
              style={{
                width: '16px',
                height: '2px',
                backgroundColor: entry.color,
                borderRadius: '1px',
              }}
            />
            <span style={{ color: '#555' }}>
              {protocol ? protocol.name : entry.value}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '700px',
        marginBottom: '40px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        margin: '0 auto', // Center the chart container
      }}
    >
      <h3
        style={{
          textAlign: 'center',
          margin: '0 0 28px 0',
          fontSize: window.innerWidth <= 768 ? '16px' : '18px',
          fontWeight: '700',
          color: '#000000',
          letterSpacing: '0.5px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        }}
      >
        {title}
      </h3>
      <ResponsiveContainer
        width="100%"
        height={height}
        style={{ margin: '0 auto' }}
      >
        <LineChart
          data={data}
          margin={{
            top: 16,
            right: window.innerWidth <= 768 ? 40 : 50,
            left: window.innerWidth <= 768 ? 16 : 24,
            bottom: 16,
          }}
        >
          <CartesianGrid
            strokeDasharray="none"
            stroke="#000000"
            strokeOpacity={0.2}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
            tick={{
              fontSize: window.innerWidth <= 768 ? 10 : 11,
              fill: '#000000',
              fontWeight: '400',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
            axisLine={{ stroke: '#000000', strokeWidth: 1 }}
            tickLine={false}
            tickMargin={window.innerWidth <= 768 ? 4 : 6}
            interval="preserveStartEnd"
            minTickGap={40}
            angle={0}
            textAnchor="middle"
          />
          <YAxis
            tickFormatter={(value) => `${value.toFixed(1)}%`}
            tick={{
              fontSize: window.innerWidth <= 768 ? 10 : 11,
              fill: '#000000',
              fontWeight: '400',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
            axisLine={{ stroke: '#000000', strokeWidth: 1 }}
            tickLine={false}
            tickMargin={window.innerWidth <= 768 ? 4 : 6}
            domain={[0, 'dataMax + 1']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />

          {/* Elegant chart lines with refined styling */}
          <Line
            type="monotone"
            dataKey="asdCRV"
            stroke="#2c3e50"
            strokeWidth={1.5}
            dot={<CustomDot />}
            activeDot={{
              r: 4,
              stroke: '#2c3e50',
              strokeWidth: 1.5,
              fill: '#fff',
              strokeOpacity: 0.9,
            }}
            connectNulls={true}
            strokeOpacity={0.9}
          />
          <Line
            type="monotone"
            dataKey="yvyCRV"
            stroke="#3498db"
            strokeWidth={1.5}
            dot={<CustomDot />}
            activeDot={{
              r: 4,
              stroke: '#3498db',
              strokeWidth: 1.5,
              fill: '#fff',
              strokeOpacity: 0.9,
            }}
            connectNulls={true}
            strokeOpacity={0.9}
          />
          <Line
            type="monotone"
            dataKey="ucvxCRV"
            stroke="#e67e22"
            strokeWidth={1.5}
            dot={<CustomDot />}
            activeDot={{
              r: 4,
              stroke: '#e67e22',
              strokeWidth: 1.5,
              fill: '#fff',
              strokeOpacity: 0.9,
            }}
            connectNulls={true}
            strokeOpacity={0.9}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default APRChart;

import { Card, CardContent } from '@mui/material';
import { panelCardSx } from './uiStyles';

/**
 * Wraps content in the shared elevated card styling used throughout the app.
 */
function SurfaceCard({ children, cardSx, contentSx }) {
  return (
    <Card sx={{ ...panelCardSx, ...cardSx }}>
      <CardContent sx={contentSx}>{children}</CardContent>
    </Card>
  );
}

export default SurfaceCard;

import { Box, Typography } from '@mui/material';

/**
 * Renders the shared page header treatment used across marketing and utility screens.
 */
function PageIntro({ eyebrow, title, description, titleProps, descriptionProps, sx }) {
  return (
    <Box sx={{ display: 'grid', gap: 1, ...sx }}>
      {eyebrow ? (
        <Typography variant="overline" color="secondary.main">
          {eyebrow}
        </Typography>
      ) : null}
      <Typography variant="h3" sx={{ fontWeight: 800, ...(titleProps?.sx || {}) }} {...titleProps}>
        {title}
      </Typography>
      {description ? (
        <Typography
          color="text.secondary"
          sx={{ maxWidth: 760, lineHeight: 1.8, ...(descriptionProps?.sx || {}) }}
          {...descriptionProps}
        >
          {description}
        </Typography>
      ) : null}
    </Box>
  );
}

export default PageIntro;

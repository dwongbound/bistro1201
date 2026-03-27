import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { Box, Grid, Stack, Typography } from '@mui/material';
import PageIntro from '../../common/PageIntro';
import SurfaceCard from '../../common/SurfaceCard';

const teamMembers = [
  {
    name: 'Dylan Wong',
    role: 'Executive Chef',
    bio: 'Shapes the seasonal menus, leads the kitchen, and sets the tone for each supper club evening.',
    image: '',
    imageAlt: 'Portrait of Chef Dylan',
  },
  {
    name: 'Noah Somphone',
    role: 'Chief Operating Officer',
    bio: 'Shapes the seasonal menus, leads the kitchen, and sets the tone for each supper club evening.',
    image: '',
    imageAlt: 'Portrait of Chef Noah',
  },
  {
    name: 'Rebecca Choi',
    role: 'Pastry Chef',
    bio: 'Welcomes guests, guides the pace of the room, and makes sure each reservation feels personal from arrival to dessert.',
    image: '',
    imageAlt: 'Portrait of the Becca',
  },
  {
    name: 'Joshua Jeung',
    role: 'Chef de Cuisine',
    bio: 'Handles the details behind the scenes so the dining room stays polished, calm, and warm throughout the night.',
    image: '',
    imageAlt: 'Portrait of the 1201 Bistro team',
  },
];

/**
 * Introduces the people behind the supper club experience.
 */
function Team() {
  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <PageIntro
        eyebrow="Meet the Team"
        title={
          <>
            <Box component="span" sx={{ display: 'inline' }}>
              Meet the{' '}
            </Box>
            <Box
              component="span"
              sx={{
                display: 'inline-flex',
                alignItems: 'baseline',
                gap: '0.02em',
                fontFamily: '"Palatino Linotype", "Book Antiqua", Georgia, serif',
                fontWeight: 800,
                letterSpacing: '0.08em',
                lineHeight: 1,
                color: 'primary.light',
                verticalAlign: 'baseline',
              }}
            >
              <Box component="span">12</Box>
              <Box component="span" sx={{ color: 'secondary.main' }}>
                0
              </Box>
              <Box component="span">1</Box>
            </Box>
            <Box component="span" sx={{ display: 'inline' }}>
              {' '}Team
            </Box>
          </>
        }
        description="A small team shapes the menu, the room, and the hospitality behind each evening."
        descriptionProps={{ sx: { maxWidth: 760 } }}
      />
      <Grid container spacing={3}>
        {teamMembers.map((member) => (
          <Grid key={member.name} size={{ xs: 12, md: 4 }}>
            <SurfaceCard cardSx={{ height: '100%', overflow: 'hidden' }} contentSx={{ p: 0 }}>
              <Stack spacing={2}>
                <Box
                  role="img"
                  aria-label={member.imageAlt}
                  sx={{
                    aspectRatio: '4 / 5',
                    width: '100%',
                    display: 'grid',
                    placeItems: 'center',
                    backgroundImage: member.image
                      ? `linear-gradient(180deg, rgba(18, 15, 13, 0.06), rgba(18, 15, 13, 0.28)), url(${member.image})`
                      : 'linear-gradient(180deg, rgba(56, 44, 34, 0.92), rgba(29, 23, 18, 0.98))',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'cover',
                    borderBottom: '1px solid rgba(217, 195, 161, 0.12)',
                  }}
                >
                  {!member.image ? (
                    <GroupsRoundedIcon sx={{ fontSize: 56, color: 'rgba(217, 195, 161, 0.7)' }} />
                  ) : null}
                </Box>
                <Box sx={{ px: { xs: 2.5, sm: 3 }, pb: { xs: 2.5, sm: 3 } }}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {member.name}
                      </Typography>
                      <Typography color="secondary.main" sx={{ fontWeight: 600 }}>
                        {member.role}
                      </Typography>
                    </Box>
                    <Typography color="text.secondary" sx={{ lineHeight: 1.75 }}>
                      {member.bio}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </SurfaceCard>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

export default Team;

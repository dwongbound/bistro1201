import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { Box, Grid, Stack, Typography } from '@mui/material';

import FadeInImage from '../../common/FadeInImage';
import PageIntro from '../../common/PageIntro';
import SurfaceCard from '../../common/SurfaceCard';
import { getR2BaseUrl } from '../../common/appConfig';

const r2 = getR2BaseUrl();
const teamPhoto = (filename) => (r2 ? `${r2}/team/${filename}` : '');

const teamMembers = [
  {
    name: 'Dylan Wong',
    role: 'Executive Chef\nCo-Founder',
    bio: 'Shapes the seasonal menus, leads the kitchen, and sets the tone for each supper club evening.',
    image: teamPhoto('dylan.JPG'),
    imageAlt: 'Portrait of Dylan',
  },
  {
    name: 'Noah Somphone',
    role: 'Chief Operating Officer\nCo-Founder',
    bio: 'Makes bread and stuff',
    image: teamPhoto('noah.JPG'),
    imageAlt: 'Portrait of Noah',
  },
  {
    name: 'Rebecca Choi',
    role: 'Pastry Chef',
    bio: 'Welcomes guests, guides the pace of the room, and makes sure each reservation feels personal from arrival to dessert.',
    image: teamPhoto('becca.JPG'),
    imageAlt: 'Portrait of the Becca',
  },
  {
    name: 'Joshua Jeung',
    role: 'Chef de Cuisine',
    bio: 'Runner.',
    image: teamPhoto('josh.JPG'),
    imageAlt: 'Portrait of the Josh',
  },
  {
    name: 'Grace Hong',
    role: 'Media Director',
    bio: 'Social media, photography, and all things visual for the 1201 Bistro brand.',
    image: teamPhoto('grace.JPG'),
    imageAlt: 'Portrait of Grace',
  },
  {
    name: 'Karen Son',
    role: 'Director of Guest Experience',
    bio: 'Welcomes guests, guides the pace of the room, and makes sure each reservation feels personal from arrival to dessert.',
    image: teamPhoto('karen.JPG'),
    imageAlt: 'Portrait of the Karen',
  },
  {
    name: 'Ezekiel Kim',
    role: 'Cafe Director / Sous Chef',
    bio: 'Welcomes guests, guides the pace of the room, and makes sure each reservation feels personal from arrival to dessert.',
    image: teamPhoto('zeke.JPG'),
    imageAlt: 'Portrait of the Zeke',
  },
  {
    name: 'Ben Chong',
    role: 'Chief Financial Officer',
    bio: 'All things finance and accounting for the 1201 Bistro business.',
    image: teamPhoto('ben.JPG'),
    imageAlt: 'Portrait of the Ben',
  },
];


/**
 * Introduces the people behind the supper club experience.
 */
function Team() {
  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <PageIntro
        eyebrow="Personnel"
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
          <Grid key={member.name} size={{ xs: 6, md: 3 }}>
            <SurfaceCard cardSx={{ height: '100%', overflow: 'hidden', background: 'transparent' }} contentSx={{ p: 0 }}>
              <Stack spacing={2}>
                <FadeInImage
                  src={member.image}
                  alt={member.imageAlt}
                  placeholder={<GroupsRoundedIcon sx={{ fontSize: 56, color: 'rgba(217, 195, 161, 0.7)' }} />}
                  sx={{ borderBottom: '1px solid rgba(217, 195, 161, 0.12)' }}
                />
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

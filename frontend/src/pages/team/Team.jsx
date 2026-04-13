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
    bio: 'Knows how to cook some things, makes sure the team is teaming, and eats food.',
    image: teamPhoto('dylan.JPG'),
    imageAlt: 'Portrait of Dylan',
  },
  {
    name: 'Noah Somphone',
    role: 'Chief Operating Officer\nCo-Founder',
    bio: 'Makes the team run, organizes stuffs, and is the master of Notion.',
    image: teamPhoto('noah.JPG'),
    imageAlt: 'Portrait of Noah',
  },
  {
    name: 'Rebecca Choi',
    role: 'Pastry Chef',
    bio: 'Can make anything that involves flour, sugar, water, or salt. Thats everything in the world?',
    image: teamPhoto('becca.JPG'),
    imageAlt: 'Portrait of the Becca',
  },
  {
    name: 'Joshua Jeung',
    role: 'Chef de Cuisine',
    bio: 'Heads menu development, instigates travel planes, and runs iron mans for fun.',
    image: teamPhoto('josh.JPG'),
    imageAlt: 'Portrait of the Josh',
  },
  {
    name: 'Grace Hong',
    role: 'Media Director',
    bio: 'Makes sure that we exist online. Organizes media, photography, oh and also yells at us if things arent out on time.',
    image: teamPhoto('grace.JPG'),
    imageAlt: 'Portrait of Grace',
  },
  {
    name: 'Karen Son',
    role: 'Director of Guest Experience',
    bio: 'Makes sure glasses are at least half full and not half empty. Gives guest a 5 star VIP experience.',
    image: teamPhoto('karen.JPG'),
    imageAlt: 'Portrait of the Karen',
  },
  {
    name: 'Ezekiel Kim',
    role: 'Cafe Director / Sous Chef',
    bio: 'What cant Zeke cook? And what drinks cant he make? Master barista and sous chef.',
    image: teamPhoto('zeke.JPG'),
    imageAlt: 'Portrait of the Zeke',
  },
  {
    name: 'Ben Chong',
    role: 'Chief Financial Officer',
    bio: 'Makes sure the books are clean and we dont spend all our money buying plateware, cooking tools, and buying random ingredients for R&D.',
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
                fontFamily: '"Montserrat", sans-serif',
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
                      <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: '"Montserrat", sans-serif' }}>
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

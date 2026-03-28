import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import { Box, Typography } from '@mui/material';
import BrandWordmark from '../../common/BrandWordmark';
import FadeInImage from '../../common/FadeInImage';
import PageIntro from '../../common/PageIntro';
import { getR2BaseUrl } from '../../common/appConfig';


const r2 = getR2BaseUrl();
const photo_file = (filename) => (r2 ? `${r2}/about/${filename}` : '');

/**
 * Summarizes the hospitality and atmosphere behind the supper club.
 */
function About() {
  // Keep the about pillars inline with the page so copy edits stay close to the rendered section.
  const highlights = [
    {
      title: 'Fresh ingredients',
      copy: 'Menus shift with the season so the kitchen can spotlight produce, seafood, and meats at their best.',
    },
    {
      title: 'Warm hospitality',
      copy: 'We want reservations, arrivals, and service to feel calm, easy, and personal from start to finish.',
    },
    {
      title: 'Evening atmosphere',
      copy: 'Soft lighting, crisp pours, and a room designed for date nights, celebrations, and unhurried dinners.',
    },
  ];

  return (
    <Box sx={{ display: 'grid', gap: 4 }}>
      <PageIntro
        eyebrow="Our story"
        title={
          <>
            <Box component="span" sx={{ display: 'block' }}>
              About
            </Box>
            <Box component="span" sx={{ display: 'block', mt: 0.2, color: 'primary.light' }}>
              <BrandWordmark sx={{ fontSize: '1em', letterSpacing: '0.05em' }} />
            </Box>
          </>
        }
        descriptionProps={{ variant: 'body1' }}
      />
      <Typography color="text.primary" sx={{ maxWidth: 800 }}>
        1201 bistro was started in 2022 by two college roomates living in downtown Los Angeles, with a desire to fellowship with friends and cook great food.
        Dinner one was simple steak dinner with duck fat fries and an arugula salad.
      </Typography>
      <Typography color="text.primary" sx={{ maxWidth: 800 }}>
        Fast forward to today, not only has our team grown but also our commitment to providing a unique dining experience.
        We aspire to create new flavor combinations using create techniques.
        Our food is special because we source everything from local farmers markets- because of our limited seating, we can buy less but higher quality ingredients.
        At our roots we employ Japanese and French techniques, but why be bind ourselves to just those?
      </Typography>
      <Typography color="text.primary" sx={{ maxWidth: 800 }}>
        1201 is more than a fine dining supper club, it's now a forum for creativity- currently consisting of 1201 Bistro and 1201 Cafe, with more concepts to come...
        We hope that at any of our services, you will be able to taste the passion and creativity that goes into every dish.
      </Typography>
      <FadeInImage
        src={photo_file('about_page_steak.jpg')}
        placeholder={<GroupsRoundedIcon sx={{ fontSize: 56, color: 'rgba(217, 195, 161, 0.7)' }} />}
        sx={{ borderBottom: '1px solid rgba(217, 195, 161, 0.12)', maxWidth: { xs: '60%', md: '40%' } }}
      />
    </Box>
  );
}

export default About;

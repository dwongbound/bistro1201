import BrandWordmark from '../../common/BrandWordmark';
import FadeInImage from '../../common/FadeInImage';
import PageIntro from '../../common/PageIntro';
import Reveal from '../../common/Reveal';
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
    imageAlt: 'Portrait of Becca',
  },
  {
    name: 'Joshua Jeung',
    role: 'Chef de Cuisine',
    bio: 'Heads menu development, instigates travel planes, and runs iron mans for fun.',
    image: teamPhoto('josh.JPG'),
    imageAlt: 'Portrait of Josh',
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
    imageAlt: 'Portrait of Karen',
  },
  {
    name: 'Ezekiel Kim',
    role: 'Cafe Director / Sous Chef',
    bio: 'What cant Zeke cook? And what drinks cant he make? Master barista and sous chef.',
    image: teamPhoto('zeke.JPG'),
    imageAlt: 'Portrait of Zeke',
  },
  {
    name: 'Ben Chong',
    role: 'Chief Financial Officer',
    bio: 'Makes sure the books are clean and we dont spend all our money buying plateware, cooking tools, and buying random ingredients for R&D.',
    image: teamPhoto('ben.JPG'),
    imageAlt: 'Portrait of Ben',
  },
];


/**
 * Introduces the people behind the supper club. Phones get compact side-by-side
 * rows; wider screens get a portrait grid.
 */
function Team() {
  return (
    <div className="grid gap-12 md:gap-16">
      <PageIntro
        eyebrow="The people"
        title={
          <>
            Meet the <BrandWordmark className="text-[0.9em] tracking-[0.05em] text-sand-light" /> team
          </>
        }
        description="A small team shapes the menu, the room, and the hospitality behind each evening."
      />
      <ul className="grid gap-x-6 gap-y-8 sm:grid-cols-2 sm:gap-y-12 lg:grid-cols-4">
        {teamMembers.map((member, index) => (
          <Reveal as="li" key={member.name} delay={(index % 4) * 90} className="group grid grid-cols-[6.5rem_1fr] content-start items-start gap-4 sm:grid-cols-1 sm:gap-5">
            <FadeInImage
              src={member.image}
              alt={member.imageAlt}
              className="aspect-square w-full rounded-xl sm:aspect-[4/5] sm:rounded-2xl"
              imgClassName="transition-transform duration-700 group-hover:scale-[1.03]"
            />
            <div className="grid gap-1.5">
              <h2 className="text-lg font-semibold text-cream">{member.name}</h2>
              <p className="text-sm font-medium text-brass-bright">{member.role.split('\n').join(' · ')}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted">{member.bio}</p>
            </div>
          </Reveal>
        ))}
      </ul>
    </div>
  );
}

export default Team;

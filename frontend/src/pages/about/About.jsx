import BrandWordmark from '../../common/BrandWordmark';
import FadeInImage from '../../common/FadeInImage';
import PageIntro from '../../common/PageIntro';
import { getR2BaseUrl } from '../../common/appConfig';

const r2 = getR2BaseUrl();
const photoFile = (filename) => (r2 ? `${r2}/about/${filename}` : '');

// Quick facts shown beside the story.
const facts = [
  { label: 'Founded', value: '2022' },
  { label: 'Where', value: 'Downtown LA' },
  { label: 'Concepts', value: 'Bistro · Cafe' },
];

/**
 * Tells the story behind the supper club, with a photo and a few quick facts.
 */
function About() {
  return (
    <div className="grid gap-14 md:gap-20">
      <PageIntro
        eyebrow="Our story"
        title={
          <>
            About <BrandWordmark className="text-[0.9em] tracking-[0.05em] text-sand-light" />
          </>
        }
      />
      <div className="grid gap-12 md:grid-cols-[1.1fr_1fr] md:gap-16">
        <div className="grid content-start gap-6 text-lg leading-relaxed text-cream/85">
          <p className="font-display text-2xl leading-snug text-cream sm:text-3xl">
            1201 Bistro was started in 2022 by two college roommates living in downtown Los Angeles, with a
            desire to fellowship with friends and cook great food.
          </p>
          <p>Dinner one was a simple steak dinner with duck fat fries and an arugula salad.</p>
          <p>
            Fast forward to today, not only has our team grown but also our commitment to providing a unique
            dining experience. We aspire to create new flavor combinations using creative techniques. Our food
            is special because we source everything from local farmers markets. Because of our limited seating,
            we can buy less but higher quality ingredients. At our roots we employ Japanese and French
            techniques, but why bind ourselves to just those?
          </p>
          <p>
            1201 is more than a fine dining supper club. It is now a forum for creativity, currently 1201 Bistro
            and 1201 Cafe, with more concepts to come. We hope that at any of our services, you will be able to
            taste the passion and creativity that goes into every dish.
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line text-base">
            {facts.map((fact) => (
              <div key={fact.label} className="grid gap-1 bg-ink-950 p-4 sm:p-5">
                <dt className="text-xs tracking-[0.18em] text-muted uppercase">{fact.label}</dt>
                <dd className="font-display text-lg text-cream sm:text-xl">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <FadeInImage
          src={photoFile('about_page_steak.jpg')}
          alt="Sliced steak plated at a 1201 Bistro dinner"
          className="aspect-[4/5] w-full rounded-2xl md:sticky md:top-8 md:self-start"
        />
      </div>
    </div>
  );
}

export default About;

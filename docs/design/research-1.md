# Research 1: Five salon-booking products (design lens) for KıbrısRandevu

**Evidence caveat (read first).** WebFetch was blocked for every host (fresha.com, planity.com, treatwell.co.uk, styleseat.com, booksy.com, further.group, fontsinuse.com, contra.com, designweek.co.uk, prnewswire.com all failed DNS). Only WebSearch snippets were available. Items tagged **[src]** come from a cited snippet. Items tagged **[inferred]** are from my general knowledge of these products, are lower confidence, and must be verified by a hands-on walkthrough before being relied on. I did not see the live sites or the dashboards.

---

## 1. Fresha
- **Positioning/tone:** Marketplace-first, confident, brand-led. Identity concept is a "spotlight", with a colour spectrum whose expressiveness can be "dialled up or down" and type that "represents the Fresha voice" [src: Further, https://www.further.group/work/fresha]. A teardown reports the headline "Book local beauty and wellness services" with search by treatment, venue, location, date and time [src: search results via Refero https://refero.design/pages/5de78c6b-fb21-4a19-b84f-d9d44922bc67].
- **Hero:** Search-led. Headline, a multi-field search bar (treatment / place / date), and a live counter of appointments booked today as a social-proof device [src: same teardown].
- **Product display:** App screenshots catalogued across 136 screens and 13 flows [src: https://uiland.design/screens/fresha/screens/198d30af-3fe7-4de5-a41d-a94b6cb69460]. Venue photography and device frames [inferred].
- **Type:** An expressive serif, Tartuffo (Lift Type), for headlines and key messages, DesignStudio identity [src: https://fontsinuse.com/uses/66929/fresha]. Paired with a neutral sans for UI [inferred].
- **Colour:** High share of white; near-black or navy standing in for black; a yellow accent reported (approx. #ffc00a, unofficial) [src: https://styles.refero.design/style/066625ba-0d8d-472e-8240-4026ed7bb94e; https://abduzeedo.com/node/86120, which may or may not be the same project].
- **Imagery:** Venue and treatment photography on a soft backdrop with sharp black type [src: Refero style page].
- **Booking flow:** A 17-screen Android flow ending in a confirmation [src: https://mobbin.com/explore/flows/e8efeafe-b203-4bea-bfbb-4a4a47b962a2]. Search offers map/list switching and richer venue profiles [src: https://www.jessicazoller.co.uk/fresha]. Typical order: services, professional, time, confirm [inferred].
- **Dashboard:** Praised as the easiest to learn; clean, colour-coded drag-and-drop calendar [src: https://pabau.com/blog/fresha-vs-booksy/, https://calendesk.com/compare/booksy-vs-fresha]. Weak Google Calendar sync [src: same].
- **Trust:** Volume counters, reviews [src/inferred].
- **Premium vs generic:** The serif plus restrained palette is the premium signal. The marketplace grid of venue cards is generic.
- **Brilliant:** Using an editorial serif in a category of sans-serif SaaS gives instant personality.
- **Weakness:** Scale-driven; the consumer side feels like an aggregator, not a place.

## 2. Booksy
- **Positioning/tone:** Pragmatic, growth/business-first for barbers and stylists. Calendar management is described as the core of the product [src: https://pabau.com/blog/fresha-vs-booksy/; Capterra https://www.capterra.com/p/142741/Booksy/reviews/].
- **Hero/marketing:** Not verifiable. Typically dual-audience (client vs business) with phone mockups and stylised barber photography [inferred].
- **Booking flow:** Find service and provider, pick from available slots, confirm in-app [src: https://biz.booksy.com/blog/how-to-book-an-appointment]. Reviewers report unnecessary animations and a confusing flow causing missed appointments, plus heavy data-collection insistence [src: https://appireview.pages.dev/net.booksy.customer].
- **Dashboard:** Colour-coded, draggable calendar [src: calendesk comparison above]. Mobile calendar can be slow to refresh [src: Capterra reviews].
- **Micro-interactions:** Animation-heavy to the point of being a usability complaint [src: appireview].
- **Trust:** Reviews and ratings; business-side UX tested through rapid design sprints [src: https://www.casestudies.com/company/uxtweak/case-study/how-booksy-optimized-design-sprints-w-rapid-testing].
- **Type/colour/imagery:** Not sourced. Teal/dark-led palette and sans-serif [inferred, low confidence].
- **Brilliant:** Treats the barber as a tradesperson with a serious calendar tool, not a "beauty" lifestyle brand.
- **Weakness:** Animation and data demands add friction; generic SaaS look [src/inferred].

## 3. Treatwell
- **Positioning/tone:** Individuality and self-expression rather than "glossy, airbrushed images of beauty" [src: https://www.designweek.co.uk/extreme-makeover-as-beauty-brand-wahanda-becomes-treatwell/, https://www.thebrandingjournal.com/2016/01/beauty-booking-site-wahanda-rebrands-as-treatwell/]. Created by DesignStudio, 2016, for ten countries.
- **Visual system:** Illustration mixed with photography, lines evoking movement, black-and-white photography for refinement, customised F37 Ginger typeface [src: same; https://fontsinuse.com/uses/37509/treatwell-brand-identity]. A Latana write-up says much of the 2016 look persists [src: https://resources.latana.com/post/treatwell-deep-dive/].
- **Hero/flow/dashboard:** Not verifiable. Rollout included a brand film and an app [src: Design Week]. Deals/discount-led marketplace [inferred].
- **Colour:** Not sourced; commonly bright accent on white [inferred].
- **Brilliant:** A distinct human, illustrated voice in a category of stock photography.
- **Weakness:** Marketplace commerce (deals, listings) tends to dilute the identity [inferred].

## 4. Planity
- **Positioning/tone:** French-born, search-led, polished and elegant. Symbol derived from the wordmark's "P"; homepage designed "bold and search-led"; top French beauty booking platform since 2016; raised over EUR 45M in 2024 [src: https://contra.com/p/Yo7Zsoq3-planity, a freelancer portfolio, no agency named].
- **Flow:** Geolocated search showing real-time slots; each listing shows prices, hours and reviews; staff can be switched inside a salon, and several dates tested quickly [src: https://sonofsneakers.fr/planity-rdv-coiffeur-institut/, https://salonpur.com/univers-salon/reservation-en-ligne-coiffeur/]. App Store review: a booking was moved to another hairdresser without clear notice, so confirmation clarity matters [src: https://apps.apple.com/fr/app/planity/id1434056190?see-all=reviews]. New-slot alerts go by email, not push [src: same]. Business-side concern: 2% commission [src: same].
- **Type/colour/imagery/dashboard:** Not verified. Reported as fluid, elegant, mobile-optimised [src: https://glumagazine.com/avis-planity-que-vaut-la-plateforme-incontournable-pour-reserver-vos-rendez-vous-beaute-et-bien-etre/]. Dark/black-and-white luxury feel [inferred].
- **Brilliant:** Search-first homepage; availability shown before commitment.
- **Weakness:** Rescheduling/staff-change transparency, notification channel limits [src].

## 5. StyleSeat
- **Positioning/tone:** Independent pros (stylists, barbers, braiders) building a personal client base; case studies emphasise repeat clients, five-star reputation and extra income [src: https://www.casestudies.com/company/styleseat/case-study/yak-the-barber-earns-700-reviews-with-styleseat].
- **Booking flow:** Redesign brought larger photos, easier booking, last-minute appointments, re-booking and past-booking reference; search results are ordered by availability [src: https://www.retaildive.com/ex/mobilecommercedaily/styleseat-sees-60pc-of-bookings-made-via-mobile-leads-to-a-redesign; https://prnewswire.com/news-releases/styleseat-introduces-redesigned-app-with-new-features-as-mobile-bookings-grow-271235771.html]. Over 60% of bookings were mobile at the time.
- **Dashboard:** Built for non-technical on-the-go pros; multi-stylist consolidation is weak [src: https://acuityscheduling.com/learn/styleseat-alternatives and the Capterra/Software Advice comparisons].
- **Hero/type/colour/imagery:** Not verified. Portfolio-photo-forward marketing [inferred].
- **Brilliant:** The professional's own portfolio and rebooking is the product; people book a person, not a venue.
- **Weakness:** Multi-staff businesses (most real barbershops) are under-served [src].

---

## Cross-product patterns and clichés to avoid
1. Search-bar hero (what / where / when) with a stock photo behind it.
2. "Book in seconds / thousands of appointments" counters and star-rating badges as the only trust device.
3. Phone mockup floating over a pastel gradient blob; dual "For clients / For business" toggle.
4. Black, white and one neon accent; geometric sans everywhere.
5. Grid of identical venue cards with a heart icon and a rating.
6. Stock "smiling stylist with tablet" photography; glossy airbrushed beauty.
7. Pastel-coloured calendar blocks with drag handles that look identical across all vendors.
8. Ornamental animation that slows booking (Booksy complaint).

## Gaps a small Cyprus product can own
- **Place and people over marketplace:** Real photographs of real Kyrenia, Nicosia, Famagusta, Güzelyurt shops and the people in them; names, hands, tools. Booking a person, not a listing (StyleSeat's insight, applied locally).
- **Warm Mediterranean palette:** Limestone/sand, terracotta, olive, carob brown, sea teal used sparingly, plus a deep ink for type. Avoid neon and cold SaaS blue.
- **Crafted typography:** One characterful serif for headlines (Fresha and Treatwell prove type is the cheapest route to personality), a humane sans for UI. Real Turkish diacritics (ı, İ, ş, ğ) rendered carefully in both TR and EN.
- **Bilingual as a design feature:** TR/EN toggle that is visible, instant and never layout-breaking; copy written natively in each language, not translated.
- **Local rhythm:** Show the day as Cyprus lives it: siesta gap, Friday prayer, Sunday closures, holidays, summer heat hours. A calendar that understands "kapalı, öğle arası" with grace.
- **Relationship cues:** "Your barber, your usual cut", rebook in one tap, WhatsApp confirmation (very likely the dominant channel locally; verify). Confirmation that states exactly who, when, where and a map pin, avoiding Planity's silent-change complaint.
- **Dashboard for the owner-operator:** A paper-appointment-book feel (warm paper tone, hand-lettered day headers, ink-coloured blocks per barber) instead of pastel SaaS blocks; big touch targets for a phone behind the chair; walk-in handling, which most competitors treat as an afterthought.
- **Restrained motion:** Short, purposeful transitions only; one signature moment (e.g., a time-slot "stamp" confirming a booking).
- **Honest trust:** Real shop owners with names and faces, local phone numbers, clear TRNC context (local currency TL plus EUR/GBP/USD where used), no fake counters.

## Unverified items to check hands-on
Live hero layouts, exact colours of Booksy/Treatwell/Planity/StyleSeat, dashboard screenshots, motion behaviour, and whether each product uses staff-first or service-first ordering. Allow these hosts or provide screenshots to close the gaps.

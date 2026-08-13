# Abdelmajid CP — Simple Academy Experience

This version uses a cleaner, shorter presentation for parents and beginners while preserving the original tracker, rankings and coach panel.

## New experience

- Simple hybrid visual direction: premium education + competitive programming
- Shorter homepage hero and one compact Level 1 course section
- Homepage course card shows 16 hours, late-August timing, “No experience needed” and the two requested buttons
- “more details” opens the question form; “join now in 30 sec” opens the application form
- The previous standalone join rectangle and larger homepage academy block were removed
- Dedicated About the Academy page at `#/about`
- Clean About page structure: short description, three benefits, coach profile, experience, achievements, facts and three-step method
- Coach photo displayed from the existing Coach Profile photo field
- Coach experience displayed on the About page
- Clear English-only published marketing experience
- Homepage coach card links to the full coach story
- Responsive styling for desktop, tablet and mobile

## Editable content

Open **Coach Panel → Settings** and edit:

- English tagline
- French tagline
- English academy description
- French academy description
- Coach name
- Coach title
- Coach short bio
- Coach experience
- Coach photo
- Coach achievements

The selected language is remembered in the visitor's browser. Existing databases are migrated safely because missing settings receive defaults automatically.

## Coach photo

The About page uses `settings.coach.photo`. Upload the real coach image from:

```text
Coach Panel → Settings → Coach Profile → Upload photo
```

If no photo is uploaded, the page shows the coach's initials as a safe fallback. Do not use an AI-generated face as a real coach photo; upload the actual photo instead.

## Draft copy

The draft copy is intentionally short and does not invent pricing, schedules, locations or results. Replace it with the academy's real information before publishing.

## Files changed

```text
index.html
css/style.css
js/store.js
js/views.js
js/admin.js
js/app.js
```

All unit, cloud, UI integration and empty-database tests pass.

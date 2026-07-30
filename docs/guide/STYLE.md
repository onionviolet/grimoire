# Writing guide pages

These pages are read by Deadlock players, often while something is broken. Optimize for the person who is annoyed and skimming.

## Shape

A task page answers one question. The title is the question a player would actually type.

1. **First sentence is the answer.** Not context, not a preamble. If someone reads only that line, they should be unblocked or know where to click.
2. **Then the steps.** Numbered, imperative, second person. One action per step.
3. **Then the explanation, if any.** Put it last so it can be skipped. Most pages do not need one.

Task pages are the default. Nearly everything you write is one.

## Length

Measure the path a reader takes through the page, not the page.

- **One question, about 400 words.** If answering it takes more than that, it was two questions.
- **A page may hold several sibling tasks for one surface**, as long as each is an independent `##` section someone can land on and leave. Nobody reads all of `locker-skins`; they came for load order, or for shuffle, and they read one section. Cap the section, not the page.
- The thing to avoid is **one continuous argument that runs long**. Seven short sections is a reference. Seven hundred words of unbroken prose is a wall.

## Concept pages

Sometimes a surface has a model underneath it that several task pages depend on. Explaining that model in each of them is worse than explaining it once.

A concept page is allowed **about 700 words**, and comes with tighter rules than a task page rather than looser ones:

- **One per subsystem, at most.** If you want a second, the first one is wrong.
- **It has to be load-bearing for two or more task pages.** Otherwise it is a task page that got indulgent.
- **No steps.** If you are telling the reader to click things, it is a task page.
- **Still answer-first.** The model goes in the lede, not after a warm-up.
- **Link down, do not absorb.** The task pages stay separate and assume the concept rather than restating it.

`locker` is the reference example: six task pages sit under it, and it exists because the "Locker overrides are not mods" distinction was going to be repeated six times otherwise.

## Rules for both

- **Name UI elements exactly as they appear.** "Settings > Game Configuration > Fix Configuration", not "the repair option". Bold the literal label.
- **Experimental features say so in the first line.** If a flag turns it on, say which. If it is only badged Experimental in the UI, say that instead, and do not send people hunting in Settings for a switch that is not there.
- **No em-dashes.** Anywhere. Colon, period, or parens.
- **Explain mechanism only where it changes what the reader does.** "Overrides sit in a folder listed first, so they always win and cost no slots" earns its place, because it predicts behavior a player will otherwise find arbitrary. Which pak number holds which override type does not. That belongs in a reference doc, and you link out.
- **Screenshots only where the UI is genuinely non-obvious.** They go stale and cost maintenance. Use the CDP screenshot harness so refreshing them is a script, not an afternoon.

## Front matter

Every page starts with:

```yaml
---
title: Fixing mods that do not load
description: One sentence, used for the page meta description and search results.
slug: troubleshooting
order: 6
updated: 2026-07-29
---
```

`slug` is a contract. The app links to `grimoiremods.com/docs/<slug>`, so renaming one breaks in-app Help links. If you must rename, update every `HelpLink` that points at it.

## Keeping pages true

A guide page that lies is worse than a missing one, because it burns the reader's trust in the rest.

When a PR changes behavior a guide page describes, update the page in the same PR. That is the whole reason these files live in the app repo instead of the site repo.

# Tester guide: the memory task

Thank you for helping. This takes about 5 minutes for a first attempt. You do not need any instructions beyond this page, and nothing you do is stored on any server.

## What this is

A research prototype that searches a small demo photo library the way memory describes things: relative time, fragments, a half-remembered color. The demo library belongs to a fictional person (AI-generated and stock photos). No photos of yours are involved.

## The task, step by step

1. Open the prototype and click the **Memory task** tab. On the first visit the search model loads (about 65 MB, one time only; the page shows a progress note).
2. Click **Start the task**. A photo appears for 8 seconds. Remember it.
3. A distraction screen asks you to count backwards for 20 seconds. This is on purpose: it pushes the photo out of short-term memory so you are left with the memory traces the research is about.
4. Type how you would search for that photo now, like telling a friend. Fragments are fine: "something by the water, everyone laughing, maybe last summer". Do not try to be precise; imprecise is the point.
5. The app shows its five closest photos, each with a confidence percentage and a band, plus a "none of these" probability. Click the photo you believe is the one, or click **None of these**.
6. The real photo is revealed, and you see where it ranked. Click **Next photo** and repeat as long as you like.

## Sending the data back

At the bottom of the Memory task tab there is a session table. Click **JSON** (or **CSV**) to download the session file, and send that file to the researcher. It contains: the task number, the query text, where the true photo ranked, the top-1 confidence, your choice, and how long you took to decide. Nothing is uploaded automatically; the file goes nowhere until you send it.

## Things worth trying outside the task

- The **Retrieve** tab accepts any memory-style description. Watch the "Understood as" chips: you can edit or remove what the system understood and re-run. That is the recovery path after a miss.
- The confidence percentage is a guide, not a promise: hovering a result explains where it comes from.
- If the best match is a photo you had deleted (in the demo story), the app tells you it existed rather than pretending to find it. Same if the content looks like something that lives in a chat app.
- The **v1** link (top right) shows the older version of this prototype, which matched typed words against text labels instead of understanding images. Compare the two on the same memory.

## What to report if something feels wrong

Note the query text and what the app showed (a screenshot helps). The researcher can re-run every measurement from scripts in the repository; nothing in the interface is hand-typed.

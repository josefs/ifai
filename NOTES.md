# Notes

## Notes on llama3

I used the llama3 model initially for development. It was hard because it would hallucinate room descriptions, exits. It also had a hard time following instructions. The game was playable but barely so at times.

Issues:

* The schema parser for the llama3 model couldn't handle enums-of-enums, which caused the parser to crash when the parser schema became too complicated.
* Hallucinate room exits
* Include an explicit list of exits despite being told not to do so.

I chose to use llama3 because that's what I had installed with ollama on my laptop when I started developing this game. I figured it would be good to try out a simple model. Llama3 is pretty old at this point though.

## Notes on nemotron-nano-9b-v2

Next I tried nemotron on openrouter. It constructed some really weird sentences.
"You extract the credentials badgefrom your grip"
Also seems to forget to put in spaces sometimes.
"You ask Miraabout your role."

It is also unreliable on the OpenRouter free tier. On 2026-05-18 every request returned an upstream Nvidia 404 ("Specified function in account ... is not found") even though the model was still listed in `/api/v1/models`. The fix was just to switch model — nothing wrong locally. Lesson: free-tier endpoints can be silently deprovisioned, so always have a fallback ready and probe with a one-shot `curl` before launching the game.

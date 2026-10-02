# usage-bars

A Claude Code mod that draws one row above the prompt, always visible:

- **Day**: the 5-hour rate-limit window
- **Week**: the 7-day rate-limit window
- **Ctx**: the context window, stacked with one color per category

Limit bars turn amber at 60% and red at 85%. A second line shows reset times and the context legend.

## Use it

Run Claude Code locally (terminal or desktop Code tab) with:

    claude --plugin-dir /path/to/astrovinh/mods/usage-bars

Day and Week need a subscription plan; on an API key they show `n/a`.
The band above the prompt draws on the terminal and desktop surfaces only.

## Develop

    claude plugin validate mods/usage-bars
    claude plugin test mods/usage-bars

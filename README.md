# passports-plugins

> **This GitHub repository is a read-only mirror.** Development, pull requests and review happen on Tangled: **https://tangled.org/passports.social/passports-plugins**. Please open pull requests and issues there; they can't be merged here.

Community passports for [passports.social](https://passports.social). Each folder under `passports/` is one passport, submitted by a contributor and checked before it is reviewed.

A passport here is **declarative**: you describe it and draw its card. You do not write SQL, a data loader, a page or forms. The app generates those from your description.

```
passports/
  national_parks/
    registry.ts   what the passport is and which fields it has (plain values, nothing executed)
    sample.json   example entries the card is previewed with
    cards/        the card that draws one entry from plain props
```

## Check a plugin

```bash
npm install
npm test          # the checks' own tests
npm run validate  # every plugin under passports/
npm run validate passports/national_parks
```

See your cards drawn from `sample.json`, in both variants:

```bash
npm run preview   # http://localhost:5195
```

The same checks run on every pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the rules and for how a plugin goes from a pull request into the app.

## License

The repository is MIT licensed (see `LICENSE`). A plugin's author keeps the copyright in it and contributes it under the same license.

# Tharigopula Technologies

The source code for [tharigopula.com](https://tharigopula.com), the official website of Tharigopula Technologies.

The application presents the company’s website, software, automation, data and AI services, along with industry playbooks, interactive demonstrations, project pricing and an enquiry workflow.

## Development

Install Node.js and npm, then run:

```sh
npm i
npm run dev
```

## Technology

- TanStack Start
- TypeScript
- React
- Tailwind CSS
- Cloudflare Workers

## Business OS showcase

The detailed NDT Business OS is maintained in the separate
`tharigopulavijay/sims-business-os` repository. The file at
`public/demos/business-os.html` is a sanitized, fictional v1.7 showcase
snapshot, not a second application to develop independently. To refresh it
from a reviewed SIMS source file, run:

```sh
node scripts/publish-business-os-demo.mjs "path/to/SIMS_Business_OS.html"
npm run test:business-os-demo
```

The published demo uses its own browser-storage keys and does not share data
with the SIMS application. The role selector changes views; it is not login or
access control. The paired SIMS website and its customer portal are separate
work and must be validated before any real-business launch.

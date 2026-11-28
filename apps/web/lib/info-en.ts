import type { InfoCopy } from "./info-types";

export const englishInfo: InfoCopy = {
  about: {
    title: "About CryptoSight AI",
    description:
      "What CryptoSight AI does, who operates it and how we prepare the guides.",
    sections: [
      {
        title: "Terminal and knowledge base",
        paragraphs: [
          "CryptoSight AI brings together charts from selected exchanges, risk tools, AI analysis and simulated trading. The public knowledge base explains these tools through examples you can reproduce without an account.",
          "The terminal serves market observation and simulation. Orders placed in the simulator stay in the virtual environment.",
        ],
      },
      {
        title: "Editorial standards",
        paragraphs: [
          "Every guide sets out its assumptions and includes an example and sources. We identify illustrative values separately from live data. If you find an incorrect calculation or an outdated source, send the article URL and the passage that needs review.",
          [
            ["contact", "Suggest a correction"],
            " · ",
            ["methodology", "Read the methodology"],
            " · ",
            ["repo", "View the source code"],
          ],
        ],
      },
    ],
  },
  methodology: {
    title: "Methodology",
    description:
      "Data sources, timestamps, AI limitations and the assumptions behind the CryptoSight AI simulator.",
    sections: [
      {
        title: "Market sources and timestamps",
        paragraphs: [
          "The terminal retrieves prices and candles from supported exchanges. Results refer to a particular pair, market type, timeframe and timestamp. The order book and other context can reflect a different moment from the quoted price. The home page chart and the numerical examples in guides are provided for practice.",
          "If values differ, compare the same market at the source and check whether the candle has closed. Missing readings can limit the analysis.",
        ],
      },
      {
        title: "AI-generated reports",
        paragraphs: [
          "A report interprets the data available for its task. Check the evidence, when it was measured and any notes on source quality. If the narrative and chart differ, return to the exchange data and record which parts of the conclusion you could reproduce.",
          [["analysisDocs", "Analysis engine documentation"]],
        ],
      },
      {
        title: "Simulation assumptions",
        paragraphs: [
          "Results depend on the execution model, liquidity and assumed costs. Keep a record of unfilled orders and cases where available data cannot reveal the sequence of prices. A historical trial describes performance under its stated assumptions.",
          [["paperDocs", "Paper trading documentation"]],
        ],
      },
    ],
  },
  contact: {
    title: "Contact",
    description:
      "Report an error in a guide, a technical issue or a privacy matter.",
    sections: [
      { title: "Publisher and contact details", publisher: true },
      {
        title: "What to include",
        paragraphs: [
          "For a correction, include the article URL, the relevant passage and any helpful source. For a technical issue, include your browser, when it happened and how to reproduce it. Keep passwords, API keys and recovery phrases private.",
          [
            "You can also report bugs in the public code through ",
            ["issues", "GitHub Issues"],
            ". Send questions about your account or personal data directly to the publisher’s email address.",
          ],
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy and cookie policy",
    description:
      "Information about account data, cookies, service providers, advertisements and your rights.",
    sections: [
      { title: "Data controller", publisher: true },
      {
        title: "Visits, accounts and contact",
        paragraphs: [
          "Public guides are available without an account. The server may process IP addresses, request times and paths, and technical data to deliver pages, secure the service and diagnose issues. If you email us, we process your address and message to respond.",
          "An account may include an email or linked wallet address, authentication data, preferences, saved analyses, alerts and simulation results. Your own AI provider keys are stored encrypted. When you run an analysis, the selected provider receives the data necessary to process the job. Hosting, email, authentication and payment providers may process data for the features they support.",
        ],
      },
      {
        title: "Legal bases and retention",
        paragraphs: [
          "We process account and feature data as needed to provide the service. Our legitimate interests may cover security, handling requests and pursuing claims. Billing obligations and legally valid requests may require processing by law. Where a feature requires consent, you can withdraw it for future processing.",
          "Account data is kept while the account is serviced, and correspondence is retained as needed to answer and resolve the matter. Legal obligations, claims or backup retention may require longer storage. Depending on the deployment and their terms, providers may process data outside the EEA. Contact the controller for information on recipients, retention and safeguards.",
        ],
      },
      {
        title: "Cookies, browser storage and Google AdSense",
        paragraphs: [
          "The terminal uses session cookies for sign-in and browser storage for preferences such as language, theme and chart settings. Your browser can clear local data. Disabling session cookies may prevent sign-in.",
          "When the publisher enables Google AdSense, Google and advertising providers may read or write cookies on selected articles, and may use IP addresses, tracking pixels and other identifiers. They may use these signals to deliver and measure ads, prevent abuse and personalize ads depending on settings and consent. Where Google’s consent message is available, you can revisit your choice in the privacy and cookie settings at the bottom of a page that carries ads.",
          "The chart on the home page connects your browser to Binance’s public market-data service. Binance receives technical connection data, including your IP address. The chart uses public spot-market prices.",
          [
            ["partnerPrivacy", "How Google uses data on partner sites"],
            " · ",
            ["adCenter", "Google My Ad Center"],
          ],
        ],
      },
      {
        title: "Your rights",
        paragraphs: [
          "Depending on the legal basis and circumstances, you can request access, correction, erasure, restriction or portability and object to processing. You can withdraw consent without affecting earlier processing. You may complain to the appropriate supervisory authority. In Poland this is the President of the Personal Data Protection Office.",
          [
            ["contact", "Contact the data controller"],
            " · ",
            ["uodo", "Polish Personal Data Protection Office"],
          ],
        ],
      },
    ],
  },
  terms: {
    title: "Terms of service",
    description:
      "Terms for using the knowledge base, terminal and simulated trading features.",
    sections: [
      { title: "Service operator", publisher: true },
      {
        title: "Service scope and requirements",
        paragraphs: [
          "The service includes public guides and a terminal with analysis and simulation features. Use an up-to-date browser and an internet connection. Some features may require an account, email address or wallet. Data availability also depends on external providers.",
        ],
      },
      {
        title: "Accounts and use of the terminal",
        paragraphs: [
          "Protect your account and credentials. Use the service lawfully and respect other people’s rights. Bypassing controls or limits and disrupting the service are prohibited. Account settings provide data export and deletion controls.",
        ],
      },
      {
        title: "Educational materials and risk",
        paragraphs: [
          "Guides, analyses and calculators are provided for education and information. AI reports can contain errors and market data can be delayed or incomplete. The simulator uses virtual funds. Illustrative outcomes depend on the stated assumptions. Trading crypto-assets carries the risk of losing funds.",
        ],
      },
      {
        title: "Support and privacy",
        paragraphs: [
          [
            "Report problems and complaints through ",
            ["contact", "the publisher’s contact page"],
            ". Include the issue, the date it occurred and how we can reach you. The ",
            ["privacy", "privacy and cookie policy"],
            " describes how we process data.",
          ],
        ],
      },
    ],
  },
};

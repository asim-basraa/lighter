import { SpecSchema, type Spec } from '@lighter/spec';

/**
 * A sample screen authored in Lighter's internal spec format (nested `{ type, props, children }`),
 * using the design system's json-render catalog components. The Render page converts it to json-render
 * and renders it through the design system — the same path Lighter-generated specs take.
 */
export const sampleSpec: Spec = SpecSchema.parse({
  root: {
    type: 'PageShell',
    props: { title: 'Order Confirmed' },
    children: [
      {
        type: 'Container',
        props: { size: 'md' },
        children: [
          {
            type: 'Stack',
            props: { direction: 'vertical', gap: '6' },
            children: [
              {
                type: 'Alert',
                props: {
                  status: 'success',
                  title: 'Payment received',
                  message: 'Your order is on its way.',
                },
                children: [],
              },
              {
                type: 'Card',
                props: { title: 'Order summary' },
                children: [
                  {
                    type: 'Stack',
                    props: { direction: 'vertical', gap: '3' },
                    children: [
                      {
                        type: 'Text',
                        props: { content: '1 item · $42.00', variant: 'body' },
                        children: [],
                      },
                      {
                        type: 'Stack',
                        props: { direction: 'horizontal', gap: '2' },
                        children: [
                          {
                            type: 'Badge',
                            props: { label: 'Paid', tone: 'success', variant: 'soft' },
                            children: [],
                          },
                          {
                            type: 'Badge',
                            props: { label: 'Priority', tone: 'primary', variant: 'soft' },
                            children: [],
                          },
                        ],
                      },
                      {
                        type: 'Button',
                        props: { label: 'View receipt', variant: 'primary' },
                        children: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
});

/** The same spec as pretty JSON, for the paste-and-render editor. */
export const sampleSpecJson = JSON.stringify(sampleSpec, null, 2);

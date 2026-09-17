'use client';

/**
 * Ported from Animate UI's Bubble Background
 * (https://animate-ui.com/docs/components/backgrounds/bubble). The original
 * is styled with Tailwind utilities; this project has no Tailwind, so the
 * same structure is expressed with the `.bubble-bg*` classes in globals.css.
 * The interactive mouse-follow blob is dropped: nobody hovers a bike screen.
 */
import * as React from 'react';
import { motion } from 'motion/react';

import { cn } from '@/lib/utils';

type BubbleColors = {
  first: string;
  second: string;
  third: string;
  fourth: string;
  fifth: string;
};

type BubbleBackgroundProps = React.ComponentProps<'div'> & {
  colors?: BubbleColors;
};

function BubbleBackground({
  className,
  children,
  colors = {
    first: '18,113,255',
    second: '221,74,255',
    third: '0,220,255',
    fourth: '200,50,50',
    fifth: '180,180,50',
  },
  style,
  ...props
}: BubbleBackgroundProps) {
  const vars = {
    '--first-color': colors.first,
    '--second-color': colors.second,
    '--third-color': colors.third,
    '--fourth-color': colors.fourth,
    '--fifth-color': colors.fifth,
  } as React.CSSProperties;

  return (
    <div data-slot="bubble-background" className={cn('bubble-bg', className)} style={{ ...vars, ...style }} {...props}>
      <svg xmlns="http://www.w3.org/2000/svg" className="bubble-bg__defs" aria-hidden>
        <defs>
          <filter id="bubble-goo">
            <feGaussianBlur in="SourceGraphic" stdDeviation="16" result="blur" />
            <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -8" result="goo" />
            <feBlend in="SourceGraphic" in2="goo" />
          </filter>
        </defs>
      </svg>

      <div className="bubble-bg__layer">
        <motion.div
          className="bubble-bg__blob bubble-bg__blob--first"
          animate={{ y: [-50, 50, -50] }}
          transition={{ duration: 30, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.div
          className="bubble-bg__orbit bubble-bg__orbit--second"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
        >
          <div className="bubble-bg__blob bubble-bg__blob--second" />
        </motion.div>
        <motion.div
          className="bubble-bg__orbit bubble-bg__orbit--third"
          animate={{ rotate: 360 }}
          transition={{ duration: 40, ease: 'linear', repeat: Infinity }}
        >
          <div className="bubble-bg__blob bubble-bg__blob--third" />
        </motion.div>
        <motion.div
          className="bubble-bg__blob bubble-bg__blob--fourth"
          animate={{ x: [-50, 50, -50] }}
          transition={{ duration: 40, ease: 'easeInOut', repeat: Infinity }}
        />
        <motion.div
          className="bubble-bg__orbit bubble-bg__orbit--fifth"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, ease: 'linear', repeat: Infinity }}
        >
          <div className="bubble-bg__blob bubble-bg__blob--fifth" />
        </motion.div>
      </div>

      {children}
    </div>
  );
}

export { BubbleBackground, type BubbleBackgroundProps, type BubbleColors };

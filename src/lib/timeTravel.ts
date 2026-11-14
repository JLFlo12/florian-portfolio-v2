/* Transition DeLorean (components/fx/TimeTravel.tsx) : quand elle a amené le changement de page,
   le rideau orange du layout ne joue pas par-dessus. */
let handled = false;

/** La DeLorean s'occupe du changement de page qui arrive. */
export const markTravel = () => { handled = true; };

/** Vrai (une seule fois) si le changement de page en cours a été amené par la DeLorean. */
export const consumeTravel = () => { const was = handled; handled = false; return was; };

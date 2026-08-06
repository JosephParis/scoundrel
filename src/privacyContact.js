// The single place the privacy contact address is defined, so changing it is a
// one-line edit rather than a search across the policy and the modals.
//
// Cloudflare Email Routing forwards this to the maintainer's personal inbox, and
// Gmail is configured to reply *as* this address (smtp.gmail.com submission on
// 587 with an App Password), so answering a deletion request never discloses the
// personal address the policy exists to protect.
//
// Verified end to end on 2026-08-06: a message sent from an outside account
// arrives, and the reply is received from privacy@sigildeck.com.
//
// If the domain or the forwarding rule changes, change it here and send a real
// message before shipping. An address in a published policy that silently drops
// mail is worse than no address at all.
export const PRIVACY_CONTACT = 'privacy@sigildeck.com'

import { Link } from 'react-router'
import { ContactLink, LegalList, LegalPage, LegalSection } from '@/pages/legal/LegalPage'
import { paths } from '@/routes/paths'

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      updated="October 14, 2026"
      intro={<p>These terms apply when you use TripSplit. By creating an account, you agree to them.</p>}
    >
      <LegalSection title="What TripSplit is — and isn't">
        <p>
          TripSplit helps you record spending and work out who owes whom. It doesn't move or hold money, process
          payments, or give financial advice. Balances are calculated from what you and the people you share with enter,
          and exchange rates are reference rates that may differ from what your bank or wallet charges — so check the
          numbers before you pay anyone.
        </p>
      </LegalSection>

      <LegalSection title="Your account">
        <LegalList>
          <li>You need to be at least 13 years old.</li>
          <li>Give accurate details and keep your password to yourself. You're responsible for what happens in your account.</li>
          <li>Only add people's names or email addresses when you're actually sharing costs with them.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          What you enter stays yours. You allow TripSplit to store it and show it to the people you share it with —
          only to run the service. Don't upload anything illegal, or anything you don't have the right to share.
        </p>
      </LegalSection>

      <LegalSection title="Fair use">
        <p>
          Don't try to break, overload or get around the security of TripSplit, access other people's data, or use it to
          harass anyone. We may suspend accounts that do.
        </p>
      </LegalSection>

      <LegalSection title="Availability and liability">
        <p>
          TripSplit is a free personal project, provided “as is” without warranties. Features may change, and the
          service may pause or end. Keep your own copies of anything important — every budget and trip can be exported
          as CSV. To the extent the law allows, we aren't liable for losses that come from using TripSplit.
        </p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          If these terms change, we'll update this page and the date at the top. Questions? Reach us through{' '}
          <ContactLink />. How we handle your data is explained in
          the{' '}
          <Link to={paths.privacy} className="font-semibold text-primary-600 hover:text-primary-700">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}

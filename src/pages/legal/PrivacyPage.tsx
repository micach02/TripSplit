import { Link } from 'react-router'
import { ContactLink, LegalList, LegalPage, LegalSection } from '@/pages/legal/LegalPage'
import { paths } from '@/routes/paths'

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="October 14, 2026"
      intro={
        <p>
          TripSplit is a free personal project. It stores what you need to track budgets and split costs, shows it only
          to the people you share it with, and nothing more: no ads, no analytics, no selling data.
        </p>
      }
    >
      <LegalSection title="What we store">
        <LegalList>
          <li>
            <strong>Your account:</strong> your name, email address and password. Passwords are handled by our sign-in
            provider and stored only in hashed form — nobody can read them.
          </li>
          <li>
            <strong>Your profile:</strong> your preferred currency and, if you add one, a profile photo.
          </li>
          <li>
            <strong>What you enter:</strong> budgets and trips (names, dates, destinations, budgets, cover photos),
            expenses (amounts, descriptions, categories, dates, notes, how they were paid and split, receipt photos),
            payments between people, recurring expenses and income entries.
          </li>
          <li>
            <strong>People you add:</strong> for someone added by name, only the name you type. For an invitation, the
            name and email address you enter for them.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Who can see it">
        <LegalList>
          <li>
            Everyone on a budget or trip sees its details, expenses, receipts, balances and payments, plus the name,
            email address and profile photo of the other members.
          </li>
          <li>Your income and your “My spending” overview are visible to you alone.</li>
          <li>An invitation is visible to the person who sent it and to whoever signs in with the invited email.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Where it's kept, and which services are involved">
        <LegalList>
          <li>
            <strong>Supabase</strong> hosts the database, sign-in and photo storage. Your data and photos are kept
            there.
          </li>
          <li>
            <strong>GitHub Pages</strong> serves the app itself. Like any web host, it sees your IP address when your
            browser downloads the app.
          </li>
          <li>
            <strong>Google Fonts</strong> provides the typeface, so Google sees your IP address and browser details when
            it loads.
          </li>
          <li>
            <strong>Frankfurter</strong> (European Central Bank reference rates): when you enter an expense in another
            currency, only the two currency codes are sent to look up the rate.
          </li>
          <li>
            <strong>jsDelivr</strong>: the first time you scan a receipt, the text-recognition engine is downloaded from
            this public network. The photo itself is read on your device; it's only uploaded if you attach it to the
            expense.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection title="Cookies and storage on your device">
        <p>
          TripSplit uses no tracking cookies. Your browser keeps your sign-in session, your preferences (like dark mode
          and the currency you view totals in), copies of recently loaded lists so the app works offline, and any
          expenses waiting to sync. Logging out removes the offline copies; expenses that haven't synced yet stay until
          you log back in.
        </p>
      </LegalSection>

      <LegalSection title="Emails">
        <p>
          You'll only get emails about your account, such as confirming your address or resetting your password. There
          are no newsletters or marketing emails.
        </p>
      </LegalSection>

      <LegalSection title="Keeping and deleting your data">
        <p>
          Your data is kept until you delete it. You can edit or delete your expenses and payments, and delete budgets
          and trips you own — which also removes their expenses, receipts and anyone added to them by name. You can
          download your data at any time as a CSV file. To delete your whole account, contact us (below) and we'll
          remove it along with everything in it.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>TripSplit isn't meant for children under 13, and we don't knowingly keep their information.</p>
      </LegalSection>

      <LegalSection title="Changes and contact">
        <p>
          If this policy changes, we'll update this page and the date at the top. Questions or requests? Reach us
          through <ContactLink />. See also our{' '}
          <Link to={paths.terms} className="font-semibold text-primary-600 hover:text-primary-700">
            Terms of Use
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}

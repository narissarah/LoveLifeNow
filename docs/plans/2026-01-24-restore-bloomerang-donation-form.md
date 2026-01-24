# Restore Bloomerang Donation Form Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the broken donation form by restoring the full self-hosted Bloomerang form code.

**Architecture:** The current `Donate/donateform.html` calls a non-existent `Bloomerang.loadSelfHostedDonationForm()` API. The working pattern from `0Example/Donate` uses an `insertForm535552()` function that injects the form HTML and sets up all Stripe/CAPTCHA/validation callbacks. We keep the current file's CSS and replace the broken JS.

**Tech Stack:** Bloomerang API v2, Stripe Elements, reCAPTCHA v2/v3, jQuery Validation

---

## Background

### The Problem
`Donate/donateform.html:404` calls:
```javascript
Bloomerang.loadSelfHostedDonationForm('535552', callback)
```
This method **does not exist** in the Bloomerang API. The form fails to load.

### The Solution
The working pattern from `0Example/Donate` (1597 lines) uses:
1. `insertForm535552()` - Contains form HTML as JS string + all setup code
2. `startBloomerangLoad()` - Loads Bloomerang-v2.js from CDN
3. `waitForBloomerangLoad()` - Waits for API ready, then calls insertForm535552()

### Key Credentials (from working source)
- Donation ID: `535552`
- Processor ID: `534529`
- Stripe Key: `pk_live_iZYXFefCkt380zu63aqUIo7y`
- Stripe Account: `acct_1SSjRKH0Bc6gCg0T`
- Bloomerang Public Key: `pub_7950352a-2c1c-11f0-abbb-062e8fd2ede7`
- reCAPTCHA v2 Site Key: `6Ld0D04sAAAAAM1V1FzEL8QeC4kvMV8RgOnynJpe`
- reCAPTCHA v3 Site Key: `6LeyBk4sAAAAAIVtFr2PRuCOEzZR8L94d_lEK436`

---

## Task 1: Create the Complete Working File

**Files:**
- Modify: `Donate/donateform.html` (complete rewrite)
- Reference: `0Example/Donate` (source of working code)

**Step 1: Read and understand the structure**

The file must have this structure:
```
HTML (lines 1-358)
├── DOCTYPE, head, meta tags
├── Fonts (Google Fonts: Inter, Poppins)
├── Link to shared/forms.css
├── <style> block with LLN-specific CSS overrides (KEEP FROM CURRENT FILE)
└── Body with loading spinner + form container

JavaScript (lines 359-end)
├── insertForm535552() function containing:
│   ├── html535552 = form HTML as concatenated string (~630 lines)
│   ├── successHtml535552 = success message HTML
│   └── (function($) { ... })() IIFE with:
│       ├── Bloomerang.useDonationId() and useProcessor()
│       ├── jQuery form insertion
│       ├── Stripe initialization via requireStripe()
│       ├── PayPal/Venmo disabling
│       ├── reCAPTCHA setup (v2 + v3)
│       ├── Transaction fee settings
│       ├── OnSubmit callback (builds Account, Donation/RecurringDonation)
│       ├── ValidateDonationFormCaptcha()
│       ├── OnSuccess callback (shows custom success message)
│       ├── OnError callback
│       ├── Custom field handlers
│       ├── Date/amount utilities
│       ├── jQuery validation rules
│       ├── Country/state change handlers
│       ├── collectPayment() async function
│       ├── submitDonation() function
│       └── Payment type radio handlers
├── startBloomerangLoad() function
├── waitForBloomerangLoad() function
└── startBloomerangLoad() call
```

**Step 2: Write the complete file**

The file is large (~1650 lines). Write it as a single complete replacement.

Key modifications from source:
1. Keep the CSS from current `donateform.html` (lines 12-344) - it's well-styled for LLN
2. Remove `<pre>` wrapper that exists in the example (it's for display purposes only)
3. Ensure custom success message is preserved:
```javascript
'<div class="donation-success">' +
'  <h2>LLN Thanks You for Your Donation!</h2>' +
'  <p>We acknowledge, with great thanks, your generous donation, which contributes to Love Life Now\'s (LLN) year-round domestic violence (DV) awareness initiatives.</p>' +
'</div>'
```

**Step 3: Verify the file loads**

Open in browser and check:
- [ ] Loading spinner appears
- [ ] Form renders with donation levels ($50, $100, $200, $500, Any Amount, Other)
- [ ] Contact fields appear (First Name, Last Name, Email, Phone)
- [ ] Address fields appear with country selector
- [ ] Payment section shows Credit Card option
- [ ] CAPTCHA renders
- [ ] Submit button shows "Donate Now"

**Step 4: Commit**
```bash
git add Donate/donateform.html
git commit -m "fix: restore working Bloomerang self-hosted donation form

- Replace broken loadSelfHostedDonationForm() call with full insertForm535552()
- Add complete form HTML template with donation levels
- Set up Stripe Elements for card payments
- Configure reCAPTCHA v2/v3
- Disable PayPal/Venmo (card-only)
- Keep custom LLN CSS styling
- Preserve custom success message

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Implementation Notes

### Why Self-Hosted vs Iframe?
- **Brand consistency**: Form matches LLN site exactly
- **Donor trust**: Native feel increases conversions
- **Mobile UX**: Responsive, no iframe resizing issues
- **Your CSS works**: All 300+ lines of custom styling apply
- **Professional**: Major nonprofits use self-hosted forms

### Critical: Do NOT use these (they don't exist)
- `Bloomerang.loadSelfHostedDonationForm()` ❌
- `Bloomerang.loadForm()` ❌
- `Bloomerang.embedForm()` ❌

### Critical: DO use this pattern
```javascript
var insertForm535552 = function() {
    var html535552 = '...<form>...</form>...';
    var successHtml535552 = '...<success message>...';
    (function($) {
        // All setup code here
    })(jQuery);
};

var startBloomerangLoad = function() { ... };
var waitForBloomerangLoad = function(callback) { ... };
startBloomerangLoad();
```

---

## Testing Checklist

After implementation, verify:

1. **Form loads** - No console errors, form visible
2. **Donation levels work** - Radio buttons selectable, "Other" enables amount field
3. **Contact fields validate** - Required fields enforced
4. **Address handles countries** - US shows State/ZIP, CA shows Province/Postal
5. **Stripe card element renders** - Card input field visible
6. **CAPTCHA appears** - reCAPTCHA visible or hidden based on v3 score
7. **Submit button works** - Shows "Donate Now $X.XX" with amount
8. **Styling matches** - Purple theme, proper spacing, LLN branding

---

## Rollback Plan

If issues occur:
1. The working example is at `0Example/Donate`
2. Git history has previous versions
3. Bloomerang dashboard has hosted form as fallback

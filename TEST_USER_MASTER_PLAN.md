# Press Golf App - Test User Master Plan

## Purpose
This document defines the complete user journey for testing the Press Golf app. Every test user (1-16) will follow this exact process, with specific test data for each user. No steps may be skipped. Every interaction must be verified.

---

## Test User Data Matrix

| # | Name | Email | Password | Handicap | Payment Method | Payment Handle | Profile Photo |
|---|------|-------|----------|----------|----------------|----------------|---------------|
| 1 | Alex Thompson | jaerard+presstest1@gmail.com | PressTest1!2024 | 2.1 | Venmo | @alexthompson-test | Male, golfer, young |
| 2 | Blake Martinez | jaerard+presstest2@gmail.com | PressTest2!2024 | 5.4 | Zelle | presstest2@test.com | Male, casual |
| 3 | Casey Johnson | jaerard+presstest3@gmail.com | PressTest3!2024 | 8.7 | CashApp | $CaseyJTest | Female, athletic |
| 4 | Drew Williams | jaerard+presstest4@gmail.com | PressTest4!2024 | 11.2 | Venmo | @drewwilliams-test | Male, older |
| 5 | Ellis Brown | jaerard+presstest5@gmail.com | PressTest5!2024 | 14.5 | Apple Pay | +1555-0105 | Non-binary, professional |
| 6 | Finley Davis | jaerard+presstest6@gmail.com | PressTest6!2024 | 16.8 | Zelle | presstest6@test.com | Female, smiling |
| 7 | Gray Wilson | jaerard+presstest7@gmail.com | PressTest7!2024 | 18.3 | Venmo | @graywilson-test | Male, middle-aged |
| 8 | Harper Moore | jaerard+presstest8@gmail.com | PressTest8!2024 | 20.1 | CashApp | $HarperMTest | Female, outdoor |
| 9 | Indigo Taylor | jaerard+presstest9@gmail.com | PressTest9!2024 | 22.6 | Venmo | @indigotaylor-test | Non-binary, artistic |
| 10 | Jordan Lee | jaerard+presstest10@gmail.com | PressTest10!2024 | 24.0 | Zelle | presstest10@test.com | Male, friendly |
| 11 | Kelly Anderson | jaerard+presstest11@gmail.com | PressTest11!2024 | 12.3 | Venmo | @kellyanderson-test | Female, corporate |
| 12 | Logan Thomas | jaerard+presstest12@gmail.com | PressTest12!2024 | 9.8 | Apple Pay | +1555-0112 | Male, sporty |
| 13 | Morgan Jackson | jaerard+presstest13@gmail.com | PressTest13!2024 | 15.7 | CashApp | $MorganJTest | Female, casual |
| 14 | Nico White | jaerard+presstest14@gmail.com | PressTest14!2024 | 19.4 | Venmo | @nicowhite-test | Male, young professional |
| 15 | Owen Harris | jaerard+presstest15@gmail.com | PressTest15!2024 | 7.2 | Zelle | presstest15@test.com | Male, experienced |
| 16 | Parker Clark | jaerard+presstest16@gmail.com | PressTest16!2024 | 28.5 | Venmo | @parkerclark-test | Non-binary, beginner vibe |

---

## Profile Photo Strategy

For realistic testing, each user needs a profile photo. Options:
1. **UI Faces API**: Professional placeholder faces
2. **randomuser.me**: Random user photos
3. **Unsplash**: Golf-related or portrait images (free to use)
4. **AI Generated**: Create consistent test personas

**Selected Approach**: Download 16 unique, appropriate profile images to `/Users/jeremyerard/Desktop/press/test-assets/profile-photos/` before testing begins.

---

## Complete User Journey Checklist

### PHASE 0: Pre-Test Setup (One Time)
- [ ] Download 16 profile photos to test-assets folder
- [ ] Verify Clerk email verification is OFF for sign-up
- [ ] Verify production database is accessible
- [ ] Clear any existing test data if needed
- [ ] Have Gmail open for sign-in verification codes

---

### PHASE 1: Sign-Up Flow

#### Step 1.1: Navigate to App
- **Action**: Open https://pressbet.golf
- **Expected**: Landing page loads with sign-in/sign-up options
- **Verify**:
  - [ ] Page loads within 3 seconds
  - [ ] PRESS logo and tagline visible
  - [ ] Sign-in form displayed
  - [ ] "Sign up" link visible
  - [ ] Apple/Google OAuth buttons present
  - [ ] "Add to Home Screen" PWA button visible
  - [ ] Mobile responsive (if testing on mobile viewport)
- **Issues Found**: _(document any issues)_

#### Step 1.2: Navigate to Sign-Up
- **Action**: Click "Sign up" link
- **Expected**: Sign-up form displays
- **Verify**:
  - [ ] URL changes to /sign-up
  - [ ] "Create your account" header
  - [ ] First name field (marked optional)
  - [ ] Last name field (marked optional)
  - [ ] Email field (required)
  - [ ] Password field with show/hide toggle
  - [ ] Continue button
  - [ ] Apple/Google OAuth options
  - [ ] "Already have an account? Sign in" link
- **Issues Found**: _(document any issues)_

#### Step 1.3: Enter First Name
- **Action**: Click first name field, type user's first name
- **Expected**: Text appears in field
- **Verify**:
  - [ ] Field accepts input
  - [ ] No character restrictions on valid names
  - [ ] Field styling indicates focus
- **Test Data**: `{firstName}` from user matrix
- **Issues Found**: _(document any issues)_

#### Step 1.4: Enter Last Name
- **Action**: Click last name field, type user's last name
- **Expected**: Text appears in field
- **Verify**:
  - [ ] Field accepts input
  - [ ] Tab navigation works from first name
- **Test Data**: `{lastName}` from user matrix
- **Issues Found**: _(document any issues)_

#### Step 1.5: Enter Email
- **Action**: Click email field, type user's email
- **Expected**: Text appears in field
- **Verify**:
  - [ ] Field accepts input
  - [ ] Email format validation (on blur or submit)
  - [ ] Clear error message if invalid format
- **Test Data**: `{email}` from user matrix
- **Issues Found**: _(document any issues)_

#### Step 1.6: Enter Password
- **Action**: Click password field, type user's password
- **Expected**: Password masked, show/hide toggle works
- **Verify**:
  - [ ] Password is masked by default
  - [ ] Show/hide toggle reveals/hides password
  - [ ] Password requirements displayed or validated
  - [ ] Minimum length enforced (8+ characters typical)
  - [ ] Complexity requirements clear
- **Test Data**: `{password}` from user matrix
- **Issues Found**: _(document any issues)_

#### Step 1.7: Submit Sign-Up
- **Action**: Click "Continue" button
- **Expected**: Account created, redirect to next step
- **Verify**:
  - [ ] Loading state shown during submission
  - [ ] No duplicate submission on double-click
  - [ ] Success redirect occurs
  - [ ] User record created in database
  - [ ] Clerk user created
  - [ ] Error handling if email already exists
- **Issues Found**: _(document any issues)_

---

### PHASE 2: Onboarding Flow

#### Step 2.1: Onboarding Welcome
- **Action**: Observe welcome screen after sign-up
- **Expected**: Onboarding wizard begins
- **Verify**:
  - [ ] Welcome message displayed
  - [ ] User's name shown (personalized)
  - [ ] Clear indication of onboarding steps
  - [ ] Progress indicator (if multi-step)
  - [ ] Skip option available (if applicable)
- **Issues Found**: _(document any issues)_

#### Step 2.2: Handicap Entry
- **Action**: Enter handicap index
- **Expected**: Numeric input accepted
- **Verify**:
  - [ ] Field accepts decimal numbers
  - [ ] Range validation: -10.0 to 54.0
  - [ ] Single decimal place formatting
  - [ ] Clear label explaining what handicap index is
  - [ ] Help text or tooltip for users unsure of handicap
  - [ ] Option for "I don't have a handicap" or estimate
- **Test Data**: `{handicap}` from user matrix
- **Issues Found**: _(document any issues)_

#### Step 2.3: GHIN Number (Optional)
- **Action**: Enter GHIN number or skip
- **Expected**: 7-digit input or skip
- **Verify**:
  - [ ] Field accepts 7 digits
  - [ ] Validation for correct format
  - [ ] Clearly marked as optional
  - [ ] Skip/continue without entering works
- **Test Data**: Generate fake GHIN: `{userNumber}123456` (e.g., 1123456 for user 1)
- **Issues Found**: _(document any issues)_

#### Step 2.4: Payment Method Selection
- **Action**: Select preferred payment method
- **Expected**: Options for Venmo, Zelle, CashApp, Apple Pay
- **Verify**:
  - [ ] All 4 payment options displayed
  - [ ] Visual icons for each method
  - [ ] Single selection (radio-style)
  - [ ] Clear indication of selected option
- **Test Data**: `{paymentMethod}` from user matrix
- **Issues Found**: _(document any issues)_

#### Step 2.5: Payment Handle Entry
- **Action**: Enter payment handle for selected method
- **Expected**: Format varies by method
- **Verify**:
  - [ ] Venmo: @username format, with or without @
  - [ ] Zelle: Email or phone number accepted
  - [ ] CashApp: $cashtag format, with or without $
  - [ ] Apple Pay: Phone number format
  - [ ] Appropriate validation per method
  - [ ] Clear placeholder/example shown
- **Test Data**: `{paymentHandle}` from user matrix
- **Issues Found**: _(document any issues)_

#### Step 2.6: Profile Photo Upload
- **Action**: Upload profile photo
- **Expected**: Image upload interface
- **Verify**:
  - [ ] Upload button/area clearly visible
  - [ ] Accepts common formats (JPG, PNG)
  - [ ] File size limit indicated
  - [ ] Preview shown after selection
  - [ ] Crop/adjust option (if available)
  - [ ] Skip option available
  - [ ] Upload progress indicator
  - [ ] Success confirmation
- **Test Data**: Upload from `/test-assets/profile-photos/user{N}.jpg`
- **Issues Found**: _(document any issues)_

#### Step 2.7: Phone Number (if required)
- **Action**: Enter phone number
- **Expected**: Phone input with formatting
- **Verify**:
  - [ ] Country code handling
  - [ ] Format validation
  - [ ] Auto-formatting as user types
  - [ ] Clear if required vs optional
- **Test Data**: `+1555010{userNumber}` (e.g., +15550101 for user 1)
- **Issues Found**: _(document any issues)_

#### Step 2.8: Complete Onboarding
- **Action**: Submit/complete onboarding
- **Expected**: Redirect to main app dashboard
- **Verify**:
  - [ ] onboardingComplete flag set to true in database
  - [ ] All entered data persisted correctly
  - [ ] Redirect to dashboard/home
  - [ ] Welcome toast/message (if any)
  - [ ] No onboarding prompt on next login
- **Issues Found**: _(document any issues)_

---

### PHASE 3: Dashboard / Home Screen

#### Step 3.1: View Dashboard
- **Action**: Observe dashboard after onboarding
- **Expected**: Main app interface displayed
- **Verify**:
  - [ ] User's name displayed
  - [ ] Profile photo shown (if uploaded)
  - [ ] Navigation accessible (hamburger or tabs)
  - [ ] "Create Round" or equivalent CTA visible
  - [ ] Empty state messaging for new user (no rounds yet)
  - [ ] Pending invites section (empty for new user)
  - [ ] Active rounds section (empty for new user)
- **Issues Found**: _(document any issues)_

#### Step 3.2: Verify Navigation
- **Action**: Test all navigation elements
- **Expected**: All links work correctly
- **Verify**:
  - [ ] Home/Dashboard link works
  - [ ] Profile link works
  - [ ] Rounds/History link works (if exists)
  - [ ] Settings link works (if exists)
  - [ ] Buddies/Friends link works (if exists)
  - [ ] Sign out option accessible
- **Issues Found**: _(document any issues)_

#### Step 3.3: View Profile
- **Action**: Navigate to profile page
- **Expected**: User profile displayed
- **Verify**:
  - [ ] Name displayed correctly
  - [ ] Email displayed
  - [ ] Handicap displayed correctly
  - [ ] GHIN number displayed (if entered)
  - [ ] Payment method displayed
  - [ ] Payment handle displayed (possibly masked)
  - [ ] Profile photo displayed
  - [ ] Edit option available
- **Issues Found**: _(document any issues)_

#### Step 3.4: Edit Profile
- **Action**: Click edit profile
- **Expected**: Edit form with current values
- **Verify**:
  - [ ] All fields pre-populated with current data
  - [ ] Can modify each field
  - [ ] Save button works
  - [ ] Cancel option available
  - [ ] Validation on save
  - [ ] Success feedback after save
  - [ ] Changes persisted to database
- **Issues Found**: _(document any issues)_

---

### PHASE 4: Create Round (Round Creator Only)

#### Step 4.1: Initiate Round Creation
- **Action**: Click "Create Round" button
- **Expected**: Round creation flow begins
- **Verify**:
  - [ ] Button easily findable
  - [ ] Click leads to course selection or creation wizard
- **Issues Found**: _(document any issues)_

#### Step 4.2: Search/Select Course
- **Action**: Search for a golf course
- **Expected**: Search interface with results
- **Verify**:
  - [ ] Search input field present
  - [ ] Search triggers on typing (debounced)
  - [ ] Results display course name, location
  - [ ] Can select from results
  - [ ] "Add new course" option if not found
  - [ ] Recent/favorite courses shown (if applicable)
- **Test Data**: Search for "Pebble Beach" or known test course
- **Issues Found**: _(document any issues)_

#### Step 4.3: Select Tee
- **Action**: Choose tee box for the round
- **Expected**: Tee options for selected course
- **Verify**:
  - [ ] All tees for course displayed
  - [ ] Tee name and color shown
  - [ ] Slope rating displayed
  - [ ] Course rating displayed
  - [ ] Yardage displayed
  - [ ] Single selection
- **Test Data**: Select appropriate tee for test
- **Issues Found**: _(document any issues)_

#### Step 4.4: Select Date
- **Action**: Choose date for the round
- **Expected**: Date picker interface
- **Verify**:
  - [ ] Default to today's date
  - [ ] Can select future dates
  - [ ] Past dates prevented or warned
  - [ ] Date format clear and consistent
- **Test Data**: Today's date
- **Issues Found**: _(document any issues)_

#### Step 4.5: Confirm Round Creation
- **Action**: Submit round creation
- **Expected**: Round created successfully
- **Verify**:
  - [ ] Loading state during creation
  - [ ] Success message/feedback
  - [ ] Redirect to round detail page
  - [ ] Round appears in database with SETUP status
  - [ ] Creator added as first player
  - [ ] Course handicap calculated for creator
  - [ ] Invite code generated
- **Issues Found**: _(document any issues)_

---

### PHASE 5: Invite Players

#### Step 5.1: View Round Detail
- **Action**: View newly created round
- **Expected**: Round detail page displayed
- **Verify**:
  - [ ] Course name displayed
  - [ ] Tee information displayed
  - [ ] Date displayed
  - [ ] Round status shown (SETUP)
  - [ ] Player list shows creator
  - [ ] Creator's handicap shown
  - [ ] "Invite Players" option visible
  - [ ] "Add Game" option visible (or locked until players join)
  - [ ] "Start Round" option (may be disabled until ready)
- **Issues Found**: _(document any issues)_

#### Step 5.2: Generate Invite Link
- **Action**: Click invite players, generate link
- **Expected**: Shareable invite link created
- **Verify**:
  - [ ] Invite modal/screen opens
  - [ ] Invite link displayed
  - [ ] Copy button works
  - [ ] Link format: pressbet.golf/invite/{code}
  - [ ] Share options (native share, SMS, etc.)
  - [ ] QR code option (if available)
- **Save**: Copy invite link for next test user
- **Issues Found**: _(document any issues)_

#### Step 5.3: Share Invite
- **Action**: Test share functionality
- **Expected**: Can share via multiple methods
- **Verify**:
  - [ ] Copy to clipboard works
  - [ ] SMS share works (on mobile)
  - [ ] Email share works
  - [ ] Native share sheet (on mobile)
- **Issues Found**: _(document any issues)_

---

### PHASE 6: Join Round (Invitee Flow)

#### Step 6.1: Open Invite Link
- **Action**: Navigate to invite link
- **Expected**: Invite landing page
- **Verify**:
  - [ ] Link resolves correctly
  - [ ] Round info preview displayed
  - [ ] Course name visible
  - [ ] Date visible
  - [ ] Host/creator name visible
  - [ ] Current players listed
  - [ ] "Join Round" CTA visible
  - [ ] Sign up/Sign in options for unauthenticated users
- **Test Data**: Use invite link from Phase 5.2
- **Issues Found**: _(document any issues)_

#### Step 6.2: Sign Up via Invite (New User)
- **Action**: Complete sign-up from invite context
- **Expected**: Sign-up with round join
- **Verify**:
  - [ ] Invite context preserved through sign-up
  - [ ] After onboarding, auto-joined to round
  - [ ] No need to manually join after sign-up
  - [ ] Redirect to round detail after onboarding
- **Issues Found**: _(document any issues)_

#### Step 6.3: Join Round (Existing User)
- **Action**: Sign in and join round
- **Expected**: Direct round join
- **Verify**:
  - [ ] Sign-in with verification code
  - [ ] After auth, round join confirmation
  - [ ] Course handicap calculated from user's handicap + tee slope
  - [ ] Added to round player list
  - [ ] Can see other players
  - [ ] Notification to round creator (if implemented)
- **Issues Found**: _(document any issues)_

---

### PHASE 7: Add Games

#### Step 7.1: Navigate to Add Game
- **Action**: Click "Add Game" from round detail
- **Expected**: Game type selection
- **Verify**:
  - [ ] All 10 game types available:
    - [ ] Nassau
    - [ ] Skins
    - [ ] Match Play
    - [ ] Wolf
    - [ ] Nines
    - [ ] Stableford
    - [ ] Bingo Bango Bongo
    - [ ] Vegas
    - [ ] Snake
    - [ ] Banker
  - [ ] Each type has brief description
  - [ ] Visual distinction between types
- **Issues Found**: _(document any issues)_

#### Step 7.2: Configure Nassau Game
- **Action**: Select Nassau, configure
- **Expected**: Nassau configuration form
- **Verify**:
  - [ ] Bet amount input (per nine)
  - [ ] Auto-press option toggle
  - [ ] Participant selection (for 2-player subset)
  - [ ] Clear explanation of Nassau rules
  - [ ] Press explanation (if auto-press selected)
- **Test Data**: $10 bet, select 2 players
- **Issues Found**: _(document any issues)_

#### Step 7.3: Configure Skins Game
- **Action**: Select Skins, configure
- **Expected**: Skins configuration form
- **Verify**:
  - [ ] Bet amount input (per skin)
  - [ ] Carryover option (if configurable)
  - [ ] Participant selection
  - [ ] Clear explanation of skins rules
- **Test Data**: $5 per skin, all players
- **Issues Found**: _(document any issues)_

#### Step 7.4: Configure Wolf Game
- **Action**: Select Wolf, configure (requires 3-4 players)
- **Expected**: Wolf configuration form
- **Verify**:
  - [ ] Bet amount input
  - [ ] Player order selection
  - [ ] Lone wolf multiplier shown
  - [ ] Blind wolf option (if applicable)
  - [ ] Participant selection (must be 3-4)
- **Test Data**: $5 per point, 4 players
- **Issues Found**: _(document any issues)_

#### Step 7.5: Verify Multiple Games
- **Action**: View round with multiple games
- **Expected**: All games displayed
- **Verify**:
  - [ ] Each game listed with type and bet
  - [ ] Participants shown per game
  - [ ] Can edit/delete games (in SETUP status)
  - [ ] Games don't conflict
- **Issues Found**: _(document any issues)_

---

### PHASE 8: Score Entry

#### Step 8.1: Start Round
- **Action**: Click "Start Round"
- **Expected**: Round status changes to ACTIVE
- **Verify**:
  - [ ] Confirmation prompt (optional)
  - [ ] Status updates to ACTIVE
  - [ ] Scorecard becomes accessible
  - [ ] Games locked (can't add more)
  - [ ] Players locked (can't add more)
- **Issues Found**: _(document any issues)_

#### Step 8.2: View Scorecard
- **Action**: Navigate to scorecard
- **Expected**: 18-hole scoring grid
- **Verify**:
  - [ ] All 18 holes displayed
  - [ ] Par for each hole shown
  - [ ] Handicap stroke allocation shown
  - [ ] All players in columns
  - [ ] Input fields for each player/hole
  - [ ] Front 9 subtotal row
  - [ ] Back 9 subtotal row
  - [ ] Total row
  - [ ] Net score calculation (if applicable)
- **Issues Found**: _(document any issues)_

#### Step 8.3: Enter Score - Hole 1
- **Action**: Enter stroke count for hole 1
- **Expected**: Score saved
- **Verify**:
  - [ ] Input accepts numbers
  - [ ] Range validation (1-15 typical max)
  - [ ] Auto-save or explicit save
  - [ ] Visual feedback on save
  - [ ] Score persists on page refresh
- **Test Data**: Enter realistic scores based on handicap
- **Issues Found**: _(document any issues)_

#### Step 8.4: Enter All Scores
- **Action**: Complete all 18 holes for all players
- **Expected**: Full scorecard
- **Verify**:
  - [ ] All scores saved
  - [ ] Running totals update
  - [ ] Front 9 total correct
  - [ ] Back 9 total correct
  - [ ] Overall total correct
  - [ ] Net scores calculated correctly (gross - handicap strokes)
- **Test Data**: See Score Entry Test Data section
- **Issues Found**: _(document any issues)_

#### Step 8.5: Real-Time Updates (Multi-User)
- **Action**: Have second user view scorecard simultaneously
- **Expected**: Scores sync in real-time
- **Verify**:
  - [ ] Score entered by User A visible to User B
  - [ ] Update within 5 seconds (or configurable)
  - [ ] No page refresh required
  - [ ] Connection status indicator (if applicable)
- **Issues Found**: _(document any issues)_

---

### PHASE 9: Complete Round & View Results

#### Step 9.1: Complete Round
- **Action**: Click "Complete Round" after all scores entered
- **Expected**: Round finalized, calculations run
- **Verify**:
  - [ ] Validation: all scores entered
  - [ ] Confirmation prompt
  - [ ] Status changes to COMPLETED
  - [ ] Game calculations triggered
  - [ ] Results generated
- **Issues Found**: _(document any issues)_

#### Step 9.2: View Game Results - Nassau
- **Action**: View Nassau results
- **Expected**: Front/Back/Overall results
- **Verify**:
  - [ ] Front 9 winner and amount
  - [ ] Back 9 winner and amount
  - [ ] Overall winner and amount
  - [ ] Net scores used for comparison
  - [ ] Tie handling correct
  - [ ] Press results (if applicable)
- **Issues Found**: _(document any issues)_

#### Step 9.3: View Game Results - Skins
- **Action**: View Skins results
- **Expected**: Skins per hole
- **Verify**:
  - [ ] Each hole shows skin winner (or carryover)
  - [ ] Carryover accumulation correct
  - [ ] Final skin distribution
  - [ ] Total money calculation
- **Issues Found**: _(document any issues)_

#### Step 9.4: View Game Results - Wolf
- **Action**: View Wolf results
- **Expected**: Points per hole and total
- **Verify**:
  - [ ] Wolf decisions shown per hole
  - [ ] Partner selection visible
  - [ ] Points calculated correctly
  - [ ] Lone wolf multiplier applied
  - [ ] Final standings
- **Issues Found**: _(document any issues)_

#### Step 9.5: Verify Zero-Sum
- **Action**: Check all money balances
- **Expected**: Total money in = Total money out
- **Verify**:
  - [ ] Sum of all winnings = Sum of all losses
  - [ ] No money created or destroyed
  - [ ] Each game independently zero-sum
- **Issues Found**: _(document any issues)_

---

### PHASE 10: Settlements

#### Step 10.1: View Settlement Summary
- **Action**: Navigate to settlements
- **Expected**: Who owes whom
- **Verify**:
  - [ ] Net amounts per player pair
  - [ ] Consolidated across all games
  - [ ] Clear positive/negative indication
  - [ ] Your total owed/receivable shown
- **Issues Found**: _(document any issues)_

#### Step 10.2: View Payment Details
- **Action**: Click on specific settlement
- **Expected**: Payment method info
- **Verify**:
  - [ ] Other player's payment method shown
  - [ ] Payment handle visible
  - [ ] Amount to pay/receive
  - [ ] "Mark as Paid" button (for payer)
  - [ ] "Confirm Received" (for receiver, if applicable)
- **Issues Found**: _(document any issues)_

#### Step 10.3: Initiate Payment
- **Action**: Click payment method link
- **Expected**: Deep link to payment app
- **Verify**:
  - [ ] Venmo: Opens Venmo with pre-filled info (if possible)
  - [ ] Zelle: Shows email/phone to send to
  - [ ] CashApp: Opens CashApp or shows $cashtag
  - [ ] Apple Pay: Shows phone number
- **Issues Found**: _(document any issues)_

#### Step 10.4: Mark Settlement Complete
- **Action**: Mark as paid after external payment
- **Expected**: Status updates
- **Verify**:
  - [ ] Confirmation prompt
  - [ ] Status changes to PAID
  - [ ] Timestamp recorded
  - [ ] Other party can see status
  - [ ] Round settlement progress updates
- **Issues Found**: _(document any issues)_

#### Step 10.5: Verify All Settled
- **Action**: Complete all settlements
- **Expected**: Round fully settled
- **Verify**:
  - [ ] All settlements marked paid
  - [ ] Round shows "Settled" status
  - [ ] Clear celebration or completion message
- **Issues Found**: _(document any issues)_

---

### PHASE 11: PWA Features

#### Step 11.1: Install PWA
- **Action**: Click "Add to Home Screen"
- **Expected**: PWA install prompt
- **Verify**:
  - [ ] Install prompt appears
  - [ ] App name correct
  - [ ] Icon appears on home screen
  - [ ] Opens as standalone app
- **Issues Found**: _(document any issues)_

#### Step 11.2: Offline Behavior
- **Action**: Disable network, use app
- **Expected**: Offline page or cached content
- **Verify**:
  - [ ] Offline indication shown
  - [ ] Cached pages accessible
  - [ ] Clear message about limited functionality
  - [ ] Reconnection handled gracefully
- **Issues Found**: _(document any issues)_

---

## Score Entry Test Data

### 4-Player Test Round Scores

Realistic scores for testing calculations. Par 72 course.

| Hole | Par | SI | Alex (2.1) | Blake (5.4) | Casey (8.7) | Drew (11.2) |
|------|-----|----|------------|-------------|-------------|-------------|
| 1 | 4 | 7 | 4 | 4 | 5 | 5 |
| 2 | 3 | 15 | 3 | 3 | 3 | 4 |
| 3 | 5 | 3 | 5 | 5 | 6 | 6 |
| 4 | 4 | 11 | 4 | 5 | 4 | 5 |
| 5 | 4 | 1 | 4 | 4 | 5 | 6 |
| 6 | 3 | 17 | 2 | 3 | 4 | 4 |
| 7 | 4 | 5 | 4 | 4 | 5 | 5 |
| 8 | 5 | 9 | 5 | 6 | 5 | 6 |
| 9 | 4 | 13 | 4 | 4 | 5 | 5 |
| **Front** | 36 | | 35 | 38 | 42 | 46 |
| 10 | 4 | 8 | 4 | 5 | 5 | 5 |
| 11 | 3 | 16 | 3 | 3 | 3 | 4 |
| 12 | 5 | 2 | 5 | 5 | 6 | 7 |
| 13 | 4 | 10 | 4 | 4 | 5 | 5 |
| 14 | 4 | 4 | 5 | 5 | 5 | 6 |
| 15 | 3 | 18 | 3 | 3 | 3 | 3 |
| 16 | 4 | 6 | 4 | 4 | 5 | 5 |
| 17 | 5 | 12 | 4 | 5 | 6 | 6 |
| 18 | 4 | 14 | 4 | 5 | 5 | 5 |
| **Back** | 36 | | 36 | 39 | 43 | 46 |
| **Total** | 72 | | 71 | 77 | 85 | 92 |

---

## Issue Documentation Template

For each issue found, document:

```markdown
### Issue #{number}

**Severity**: BLOCKER / MAJOR / MINOR
**Phase**: {phase number and name}
**Step**: {step number}
**User**: Test User {N}

**Description**:
{What happened}

**Expected**:
{What should have happened}

**Actual**:
{What actually happened}

**Screenshot**: {if applicable}

**File/Line**: {if code issue identified}

**Fix Applied**:
{Description of fix, or "Pending"}
```

---

## Execution Log

### Test User 1: Alex Thompson
**Date Started**: ___________
**Issues Found**: ___________
**Status**: NOT STARTED / IN PROGRESS / COMPLETE

### Test User 2: Blake Martinez
**Date Started**: ___________
**Issues Found**: ___________
**Status**: NOT STARTED / IN PROGRESS / COMPLETE

(Continue for all 16 users...)

---

## Deployment Log

| Deploy # | Date | Issues Fixed | Commit | Verified By |
|----------|------|--------------|--------|-------------|
| 1 | | | | User 2 |
| 2 | | | | User 3 |
| ... | | | | |


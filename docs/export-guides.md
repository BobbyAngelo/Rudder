# Data Export Mini-Guides

Rudder is a local - first personal operating system. To populate your memory ledger, you can export your data from external platforms and sync them locally. Below are step - by - step instructions on how to get your data from each supported service.

---

## 1. Apple Health (export.xml)

1. Open the **Health** app on your iPhone.
2. Tap your profile picture or initials in the top right corner.
3. Scroll to the bottom of the page and tap **Export All Health Data**.
4. Confirm the export and wait for the process to complete (this can take a few minutes if you have years of history).
5. Share the resulting `.zip` file to your Mac (via AirDrop, local network, or iCloud Drive).
6. Unzip the file on your Mac to find the `apple_health_export/export.xml` file.

---

## 2. Calendar (export.ics)

### Google Calendar
1. Open [Google Calendar](https://calendar.google.com) in your desktop browser.
2. Click the gear settings icon in the top right and select **Settings**.
3. In the left navigation sidebar, click **Import & export**.
4. Under the Export section, click the **Export** button to download a `.zip` archive containing your `.ics` calendar files.

### Apple Calendar
1. Open the **Calendar** application on macOS.
2. Select the target calendar in the left sidebar.
3. Go to the top menu and select **File -> Export -> Export...** to save the calendar as an `.ics` file.

---

## 3. Contacts (export.vcf)

### Google Contacts
1. Open [Google Contacts](https://contacts.google.com) in your browser.
2. Select the contacts you wish to export, or select all.
3. Click the export icon or **Export** option in the menu.
4. Select **vCard (for iOS Contacts)** format and click **Export** to download the `.vcf` file.

### Apple Contacts
1. Open the **Contacts** application on macOS.
2. Select the contacts you want to export.
3. Go to the top menu and select **File -> Export -> Export vCard...** to save the `.vcf` file.

---

## 4. LinkedIn Profile & Archive

1. Log in to [LinkedIn](https://www.linkedin.com) on a desktop browser.
2. Click your profile picture at the top and select **Settings & Privacy**.
3. Click **Data privacy** in the left menu.
4. Under **How LinkedIn uses your data**, select **Get a copy of your data**.
5. Select either the quick archive or full archive, request it, and download the `.zip` archive once LinkedIn emails you the download link.

---

## 5. Outlook Mail (export.olm)

1. Open the **Outlook** client application on your Mac.
2. Navigate to the **Tools** tab in the top ribbon bar and click **Export**.
3. Check the item categories you want to backup (Mail, Calendar, Contacts, Tasks, Notes) and click **Continue**.
4. Specify your desired save directory and save the resulting `.olm` archive file.

---

## 6. Browser History & Bookmarks

### Browser History (Chrome / Arc)
Google Chrome, Arc, Brave, and Microsoft Edge store history in a local SQLite file.
1. Navigate to the history folder on macOS:
   - **Chrome**: `~/Library/Application Support/Google/Chrome/Default/History`
   - **Arc**: `~/Library/Application Support/Arc/User Data/Default/History`
2. **Important**: Always copy this file to a separate location (e.g. your documents folder) before sync, as the browser locks the file while it is running.

### Bookmarks (Netscape HTML Export)
1. Open the bookmarks manager in your browser (e.g. `chrome://bookmarks/`).
2. Click the three dots menu button and select **Export bookmarks**.
3. Save the resulting HTML file.

---

## 7. Chat Logs (ChatGPT / Claude)

### ChatGPT
1. Open [ChatGPT](https://chatgpt.com) and click your profile image/icon in the top right.
2. Select **Settings**.
3. Navigate to **Data Controls**.
4. Click the **Export** button. OpenAI will package your conversations and email you a link to download the `.zip` file containing `conversations.json`.

### Claude
1. Open [Claude.ai](https://claude.ai) and click your profile image/icon in the bottom left.
2. Select **Settings**.
3. Under the **Account** tab, scroll down to the **Export Data** section.
4. Click the export button to download a copy of your chat history.

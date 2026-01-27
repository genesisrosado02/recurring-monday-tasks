const express = require('express');
const axios = require('axios');
const app = express();

// Use express.json() to parse incoming payloads from monday.com
app.use(express.json());

const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// --- 1. OPTION ENDPOINTS (Required for your Dropdowns) ---
app.all('/get-nth-options', (req, res) => res.json([
    {title:"1st",value:"1"},{title:"2nd",value:"2"},{title:"3rd",value:"3"},{title:"4th",value:"4"}
]));

app.all('/get-day-options', (req, res) => res.json([
    {title:"Monday",value:"1"},{title:"Tuesday",value:"2"},{title:"Wednesday",value:"3"},{title:"Thursday",value:"4"},{title:"Friday",value:"5"},{title:"Saturday",value:"6"},{title:"Sunday",value:"0"}
]));

app.get('/', (req, res) => res.status(200).send("Server is live."));

// --- 2. MAIN ACTION: CALCULATE AND SET DATE ---
app.post('/calculate-task-on-nth-day', async (req, res) => {
    try {
        const payload = req.body.payload || req.body;
        const fields = payload.inputFields || {};

        // MATCHING YOUR DEVELOPER CENTER KEYS
        const boardId = fields.boardId;
        const itemId = fields.itemLikeId; // Updated key from image_24bbd6.png
        const dateCol = fields.dateColumnId; // Key from image_2f1940.png
        const statusCol = fields.statusColumnId; // Key from image_2f1940.png

        // DEBUG LOGGING: Verify these in your Render console
        console.log("-----------------------------------------");
        console.log(`🚀 REQUEST RECEIVED FOR ITEM: ${itemId}`);
        console.log(`📥 Board: ${boardId} | DateCol: ${dateCol} | StatusCol: ${statusCol}`);

        // Validation to prevent 400 errors if mapping fails
        if (!itemId || itemId === "undefined" || !boardId) {
            console.error("❌ MAPPING ERROR: Missing itemId or boardId. Check 'Trigger output field usages' setting.");
            return res.status(200).send({}); 
        }

        // --- CALCULATION LOGIC ---
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const dayToFind = parseInt(fields.day_of_week?.value || fields.day_of_week);
        const occurrence = parseInt(fields.nth_occurence?.value || fields.nth_occurence);

        if (isNaN(dayToFind) || isNaN(occurrence)) {
            throw new Error(`Invalid math inputs: Day=${dayToFind}, Occurrence=${occurrence}`);
        }

        // Find the Nth occurrence of the day
        while (d.getDay() !== dayToFind) d.setDate(d.getDate() + 1);
        d.setDate(d.getDate() + (occurrence - 1) * 7);
        
        const calculatedDate = d.toISOString().split('T')[0];
        const currentMonth = monthNames[now.getMonth()];

        console.log(`✅ CALCULATION: ${calculatedDate} (${currentMonth})`);

        // --- MONDAY API UPDATE (2025-04 MIGRATION) ---
        const columnValues = JSON.stringify({
            [dateCol]: { "date": calculatedDate },
            [statusCol]: { "label": currentMonth }
        });

        const query = `mutation ($board: ID!, $item: ID!, $values: JSON!) { 
            change_multiple_column_values (
                board_id: $board, 
                item_id: $item, 
                column_values: $values,
                create_labels_if_missing: true
            ) { id } 
        }`;

        const variables = { 
            board: String(boardId), 
            item: String(itemId), 
            values: columnValues 
        };

        const response = await axios.post('https://api.monday.com/v2', 
            { query, variables }, 
            { headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'API-Version': '2025-04',
                'Content-Type': 'application/json'
            }}
        );

        if (response.data.errors) {
            console.error("❌ MONDAY API ERROR:", JSON.stringify(response.data.errors));
        } else {
            console.log(`🎉 SUCCESS: Updated Item ${itemId}`);
        }

        // Return outputs so the "Success" screen shows the values
        res.status(200).send({
            outputFields: {
                date: calculatedDate,
                month_name: currentMonth
            }
        });

    } catch (err) {
        // Corrected JSON.stringify fix
        console.error("❌ SYSTEM ERROR:", err.message);
        res.status(200).send({}); 
    }
});

// --- 3. SERVER START ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Server live on port ${PORT}`));

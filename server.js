const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🛠️ SETTINGS (HARDCODED FOR STABILITY) ---
const MONDAY_API_TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjU5NzExMzIwNiwiYWFpIjoxMSwidWlkIjo1ODcxODIxMCwiaWFkIjoiMjAyNS0xMi0xMlQxNTo0NjoyNS4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6Nzc5NTAzMiwicmduIjoidXNlMSJ9.-ByFZPQtY9h8CdsSuCPhxbE-MJtRhNfybaVSM21QlQQ"; // 👈 PASTE YOUR TOKEN HERE
const DATE_COLUMN_ID = "date_mkyj80vp"; 

// --- 1. REMOTE OPTIONS ---

app.all('/get-nth-options', (req, res) => {
    console.log("--> Nth options requested");
    const options = [
        { title: "1st", value: "1" },
        { title: "2nd", value: "2" },
        { title: "3rd", value: "3" },
        { title: "4th", value: "4" }
    ];
    return res.status(200).json(options);
});

app.all('/get-day-options', (req, res) => {
    console.log("--> Day options requested");
    const options = [
        { title: "Monday", value: "1" }, 
        { title: "Tuesday", value: "2" },
        { title: "Wednesday", value: "3" }, 
        { title: "Thursday", value: "4" }, 
        { title: "Friday", value: "5" }, 
        { title: "Saturday", value: "6" },
        { title: "Sunday", value: "0" }
    ];
    return res.status(200).json(options);
});

// --- 2. MAIN ACTION (The Task Creator) ---

app.post('/calculate-task', async (req, res) => {
    try {
        console.log("--> Action triggered! Incoming payload...");
        const body = req.body;
        
        // Log the full payload so we can verify the structure in Render logs
        console.log("Full Payload Received:", JSON.stringify(body));

        // Drill down into Monday's nested structure
        const payload = body.payload || body; 
        const inputFields = payload.inboundFieldValues || (payload.inPublic && payload.inPublic.inputFields);

        if (!inputFields) {
            console.error("❌ ERROR: inputFields is missing.");
            return res.status(200).send({ error: "Missing fields" });
        }

        // --- EXTRACT VALUES FROM MONDAY OBJECTS ---
        // Monday often sends dropdowns as { "title": "2nd", "value": "2" }
        const boardId = inputFields.boardId;
        const task_name = inputFields.task_name;
        
        // Handle Person ID (could be a number or an object with an id)
        const assignee_id = inputFields.assignee_id?.id || inputFields.assignee_id;
        
        // Handle Dropdown Objects
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;

        console.log(`Calculating: ${nth} occurrence of weekday ${day} on board ${boardId}`);

        // --- DATE CALCULATION LOGIC ---
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) {
            d.setDate(d.getDate() + 1);
        }
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
        const formattedDate = d.toISOString().split('T')[0];

        // --- PREPARE MONDAY MUTATION ---
        const columnValues = {
            [DATE_COLUMN_ID]: { "date": formattedDate },
            "person": { "personsAndTeams": [{ "id": parseInt(assignee_id), "kind": "person" }] }
        };

        const query = `mutation {
            create_item (
                board_id: ${parseInt(boardId)},
                item_name: "${task_name || 'Recurring Task'}", 
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id }
        }`;

        const response = await axios.post('https://api.monday.com/v2', { query }, {
            headers: { 
                'Authorization': MONDAY_API_TOKEN, 
                'Content-Type': 'application/json',
                'API-Version': '2024-01' 
            }
        });

        if (response.data.errors) {
            console.error("❌ MONDAY API REJECTED REQUEST:", JSON.stringify(response.data.errors));
        } else if (response.data.data && response.data.data.create_item) {
            console.log("✅ SUCCESS! Created Task ID:", response.data.data.create_item.id);
        } else {
            console.log("❓ RESPONSE UNKNOWN:", JSON.stringify(response.data));
        }

        res.status(200).send({});
    } catch (err) {
        console.error("🔥 SERVER CRASHED:", err.message);
        res.status(500).send({ error: "Internal server error" });
    }
});

// --- 3. SERVER BOOTUP ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server live on port ${PORT}`);
});

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🛠️ SETTINGS (HARDCODED FOR SUCCESS) ---
const MONDAY_API_TOKEN = "YOUR_ACTUAL_API_TOKEN_HERE"; // 👈 Paste your token inside the quotes
const DATE_COLUMN_ID = "date_mkyj80vp"; 

// --- 1. REMOTE OPTIONS (Corrected to 'title') ---

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

// --- 2. MAIN ACTION (Create New Task) ---

app.post('/calculate-task', async (req, res) => {
    try {
        console.log("--> Action triggered! Incoming payload...");
        const { payload } = req.body;
        
        if (!payload || !payload.inPublic || !payload.inPublic.inputFields) {
            console.log("Empty or malformed payload received.");
            return res.status(200).send({});
        }

        const { boardId, task_name, assignee_id, nth_occurrence, day_of_week } = payload.inPublic.inputFields;

        // Date Calculation Logic
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day_of_week)) {
            d.setDate(d.getDate() + 1);
        }
        d.setDate(d.getDate() + (parseInt(nth_occurrence) - 1) * 7);
        const formattedDate = d.toISOString().split('T')[0];

        // ⚠️ PERSON COLUMN SYNTAX: Monday requires 'personsAndTeams' for People columns
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

        console.log("Sending mutation to Monday...");

        const response = await axios.post('https://api.monday.com/v2', { query }, {
            headers: { 
                'Authorization': MONDAY_API_TOKEN, 
                'Content-Type': 'application/json',
                'API-Version': '2024-01' 
            }
        });

        // Detailed Logging to catch the "Silent Success"
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

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server live on port ${PORT}`);
});

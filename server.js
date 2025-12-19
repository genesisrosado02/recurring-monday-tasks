_const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 🔒 SAFE SETTINGS (Using Environment Variables) ---
const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN; 
const DATE_COLUMN_ID = process.env.DATE_COLUMN_ID; 

// --- 1. REMOTE OPTIONS ---
app.all('/get-nth-options', (req, res) => {
    const options = [
        { title: "1st", value: "1" }, { title: "2nd", value: "2" },
        { title: "3rd", value: "3" }, { title: "4th", value: "4" }
    ];
    return res.status(200).json(options);
});

app.all('/get-day-options', (req, res) => {
    const options = [
        { title: "Monday", value: "1" }, { title: "Tuesday", value: "2" },
        { title: "Wednesday", value: "3" }, { title: "Thursday", value: "4" }, 
        { title: "Friday", value: "5" }, { title: "Saturday", value: "6" },
        { title: "Sunday", value: "0" }
    ];
    return res.status(200).json(options);
});

// --- 2. MAIN ACTION ---
app.post('/calculate-task', async (req, res) => {
    try {
        const body = req.body;
        const payload = body.payload || body; 
        const inputFields = payload.inboundFieldValues || (payload.inPublic && payload.inPublic.inputFields);

        if (!inputFields) return res.status(200).send({});

        const { boardId, task_name, assignee_id } = inputFields;
        const nth = inputFields.nth_occurence?.value || inputFields.nth_occurence;
        const day = inputFields.day_of_week?.value || inputFields.day_of_week;

        // Date Calculation
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day)) {
            d.setDate(d.getDate() + 1);
        }
        d.setDate(d.getDate() + (parseInt(nth) - 1) * 7);
        const formattedDate = d.toISOString().split('T')[0];

        // Column values
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

        await axios.post('https://api.monday.com/v2', { query }, {
            headers: { 
                'Authorization': MONDAY_API_TOKEN, 
                'Content-Type': 'application/json',
                'API-Version': '2024-01' 
            }
        });

        res.status(200).send({});
    } catch (err) {
        console.error("🔥 Error:", err.message);
        res.status(500).send({ error: "Internal error" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server live on port ${PORT}`);
});

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 1. REMOTE OPTIONS HANDLERS ---

app.all('/get-nth-options', (req, res) => {
    console.log("--> Nth options requested by Monday");
    try {
        // Monday expects a 200 status and a JSON array of label/value objects
        const options = [
            { label: "1st", value: "1" },
            { label: "2nd", value: "2" },
            { label: "3rd", value: "3" },
            { label: "4th", value: "4" }
        ];
        return res.status(200).json(options);
    } catch (err) {
        console.error("Dropdown Error:", err.message);
        return res.status(500).json({ error: "Failed to generate options" });
    }
});

app.all('/get-day-options', (req, res) => {
    console.log("--> Day options requested by Monday");
    try {
        const options = [
            { label: "Monday", value: "1" }, { label: "Tuesday", value: "2" },
            { label: "Wednesday", value: "3" }, { label: "Thursday", value: "4" },
            { label: "Friday", value: "5" }, { label: "Saturday", value: "6" },
            { label: "Sunday", value: "0" }
        ];
        return res.status(200).json(options);
    } catch (err) {
        console.error("Dropdown Error:", err.message);
        return res.status(500).json({ error: "Failed to generate options" });
    }
});

// --- 2. MAIN CALCULATION ACTION ---

app.post('/calculate-task', async (req, res) => {
    try {
        console.log("--> Action triggered! Processing task creation...");
        const { payload } = req.body;
        
        if (!payload || !payload.inPublic || !payload.inPublic.inputFields) {
            return res.status(200).send({});
        }

        const { boardId, task_name, assignee_id, nth_occurrence, day_of_week } = payload.inPublic.inputFields;

        // Date logic: Find the Nth [Day] of current month
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day_of_week)) {
            d.setDate(d.getDate() + 1);
        }
        d.setDate(d.getDate() + (parseInt(nth_occurrence) - 1) * 7);
        const formattedDate = d.toISOString().split('T')[0];

        // Column values (using your 'person' ID)
        const columnValues = {
            [process.env.DUE_DATE_COLUMN_ID]: { "date": formattedDate },
            "person": { "id": assignee_id }
        };

        const query = `mutation {
            create_item (
                board_id: ${boardId},
                item_name: "${task_name || 'Recurring Task'}", 
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id }
        }`;

        await axios.post('https://api.monday.com/v2', { query }, {
            headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'Content-Type': 'application/json' 
            }
        });

        console.log("--> Success: Task created with date", formattedDate);
        res.status(200).send({});
    } catch (err) {
        console.error("CRITICAL ERROR:", err.message);
        res.status(500).send({ error: "Creation failed" });
    }
});

// --- 3. PORT SETUP ---

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server live and listening on port ${PORT}`);
});

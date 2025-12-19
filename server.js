const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 1. DROPDOWN OPTIONS (The menus for your recipe) ---

// This populates the "1st, 2nd..." dropdown
app.post('/get-nth-options', (req, res) => {
    const options = [
        { label: "1st", value: "1" },
        { label: "2nd", value: "2" },
        { label: "3rd", value: "3" },
        { label: "4th", value: "4" }
    ];
    res.status(200).send(options);
});

// This populates the "Monday, Tuesday..." dropdown
app.post('/get-day-options', (req, res) => {
    const options = [
        { label: "Monday", value: "1" }, { label: "Tuesday", value: "2" },
        { label: "Wednesday", value: "3" }, { label: "Thursday", value: "4" },
        { label: "Friday", value: "5" }, { label: "Saturday", value: "6" },
        { label: "Sunday", value: "0" }
    ];
    res.status(200).send(options);
});

// --- 2. THE MAIN ACTION: CREATE & ASSIGN ---

app.post('/calculate-task', async (req, res) => {
    try {
        const { payload } = req.body;
        if (!payload || !payload.inPublic || !payload.inPublic.inputFields) {
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

        // Prepare Column Values
        // Using 'person' directly as you confirmed that is your Column ID
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

        res.status(200).send({});
    } catch (err) {
        console.error("ERROR:", err.message);
        res.status(500).send({ error: "Creation failed" });
    }
});

// --- 3. PORT BINDING (Crucial for Render) ---

const PORT = process.env.PORT || 10000; 
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server live on port ${PORT}`);
});

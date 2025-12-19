const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); 
const app = express();

app.use(bodyParser.json());

// 1. Dropdown Menus for the Recipe
app.post('/get-day-options', (req, res) => {
    res.status(200).send([
        { label: "Monday", value: 1 }, { label: "Tuesday", value: 2 },
        { label: "Wednesday", value: 3 }, { label: "Thursday", value: 4 },
        { label: "Friday", value: 5 }, { label: "Saturday", value: 6 },
        { label: "Sunday", value: 0 }
    ]);
});

app.post('/get-nth-options', (req, res) => {
    res.status(200).send([
        { label: "1st", value: 1 }, { label: "2nd", value: 2 },
        { label: "3rd", value: 3 }, { label: "4th", value: 4 }
    ]);
});

// 2. The Main Action: Create, Assign, and Date
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

        // Building the Column Values (Using your ID: person)
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

const PORT = process.env.PORT || 10000; // Updated to match Render's detection
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is strictly listening on port ${PORT}`);
});

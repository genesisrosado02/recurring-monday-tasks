const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const app = express();

app.use(bodyParser.json());

// --- 1. DROPDOWN OPTIONS (Using .all for browser & monday compatibility) ---

// Populates the "1st, 2nd, 3rd..." dropdown
app.all('/get-nth-options', (req, res) => {
    const options = [
        { label: "1st", value: "1" },
        { label: "2nd", value: "2" },
        { label: "3rd", value: "3" },
        { label: "4th", value: "4" }
    ];
    res.status(200).json(options);
});

// Populates the "Monday, Tuesday..." dropdown
app.all('/get-day-options', (req, res) => {
    const options = [
        { label: "Monday", value: "1" }, { label: "Tuesday", value: "2" },
        { label: "Wednesday", value: "3" }, { label: "Thursday", value: "4" },
        { label: "Friday", value: "5" }, { label: "Saturday", value: "6" },
        { label: "Sunday", value: "0" }
    ];
    res.status(200).json(options);
});

// --- 2. THE MAIN ACTION: CREATE, ASSIGN, AND DATE ---

app.post('/calculate-task', async (req, res) => {
    try {
        const { payload } = req.body;
        if (!payload || !payload.inPublic || !payload.inPublic.inputFields) {
            return res.status(200).send({});
        }

        const { boardId, task_name, assignee_id, nth_occurrence, day_of_week } = payload.inPublic.inputFields;

        // Date Calculation: Finds the Nth [Day] of the Current Month
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        
        // Start at the 1st of the month
        let d = new Date(year, month, 1);
        
        // Find the first occurrence of the target day of the week
        const targetDay = parseInt(day_of_week);
        while (d.getDay() !== targetDay) {
            d.setDate(d.getDate() + 1);
        }
        
        // Add weeks to get to the Nth occurrence
        d.setDate(d.getDate() + (parseInt(nth_occurrence) - 1) * 7);
        const formattedDate = d.toISOString().split('T')[0];

        // Prepare Column Values (Hardcoded 'person' as requested)
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

// --- 3. PORT BINDING (Render standard) ---

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server strictly listening on port ${PORT}`);
});

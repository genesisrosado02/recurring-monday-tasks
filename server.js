const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); 
const app = express();

// Use JSON body parser to handle monday.com payloads
app.use(bodyParser.json());

// 1. DROPDOWN OPTIONS: Monday calls these to fill your menus
app.post('/get-day-options', (req, res) => {
    res.status(200).send([
        { label: "Monday", value: 1 },
        { label: "Tuesday", value: 2 },
        { label: "Wednesday", value: 3 },
        { label: "Thursday", value: 4 },
        { label: "Friday", value: 5 },
        { label: "Saturday", value: 6 },
        { label: "Sunday", value: 0 }
    ]);
});

app.post('/get-nth-options', (req, res) => {
    res.status(200).send([
        { label: "1st", value: 1 },
        { label: "2nd", value: 2 },
        { label: "3rd", value: 3 },
        { label: "4th", value: 4 }
    ]);
});

// 2. THE MAIN ACTION: Calculates date and creates the task
app.post('/calculate-task', async (req, res) => {
    try {
        const { payload } = req.body;

        // --- SAFETY SHIELD ---
        // If Monday is just "checking" the connection and hasn't sent data yet, stop here.
        if (!payload || !payload.inPublic || !payload.inPublic.inputFields) {
            console.log("Received a 'Check-In' request from Monday. Sending success...");
            return res.status(200).send({});
        }

        // --- THE ACTUAL LOGIC ---
        const { boardId, task_name, nth_occurrence, day_of_week, item_mapping } = payload.inPublic.inputFields;

        // Date Calculation Math
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day_of_week)) { 
            d.setDate(d.getDate() + 1); 
        }
        d.setDate(d.getDate() + (parseInt(nth_occurrence) - 1) * 7);
        const formattedDate = d.toISOString().split('T')[0];

        // Prepare the Column Values (Including Person/Status/Group mapping)
        const columnValues = item_mapping || {};
        
        // Add the calculated date to the mapping
        // IMPORTANT: Make sure DUE_DATE_COLUMN_ID is set in your Render Env Variables!
        if (process.env.DUE_DATE_COLUMN_ID) {
            columnValues[process.env.DUE_DATE_COLUMN_ID] = { "date": formattedDate };
        }

        const query = `mutation {
            create_item (
                board_id: ${boardId},
                item_name: "${task_name}",
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id }
        }`;

        console.log("Creating item with values:", columnValues);

        await axios.post('https://api.monday.com/v2', { query }, {
            headers: { 
                'Authorization': process.env.MONDAY_API_TOKEN, 
                'Content-Type': 'application/json' 
            }
        });

        res.status(200).send({});
    } catch (err) {
        console.error("CRITICAL ERROR:", err.message);
        res.status(500).send({ error: "Server error during task calculation" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

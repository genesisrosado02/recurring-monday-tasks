const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios'); 
const app = express();
app.use(bodyParser.json());

// 1. THE DROPDOWN LIST (For Monday's UI)
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

// 2. THE MAIN MATH & CREATION LOGIC
app.post('/calculate-task', async (req, res) => {
    try {
        // 1. ADD THIS CHECK: 
        // If it's just Monday asking for fields/options, ignore the math and send 200 OK.
        if (!req.body.payload || !req.body.payload.inPublic || !req.body.payload.inPublic.inputFields) {
            return res.status(200).send({}); 
        }

        // 2. THE NORMAL LOGIC (Only runs when inputFields exists)
        const { payload } = req.body;
        const { boardId, task_name, nth_occurrence, day_of_week, item_mapping } = payload.inPublic.inputFields;

        // ... rest of your math and creation code ...
        // (Ensure the code you have below this is the one from the "Pro" update)
        
        res.status(200).send({});
    } catch (err) {
        console.error("Error Detail:", err.message); // This will show more detail in Render logs
        res.status(500).send({ error: "Failed to calculate task" });
    }
});
        // MATH
        const now = new Date();
        let d = new Date(now.getFullYear(), now.getMonth(), 1);
        while (d.getDay() !== parseInt(day_of_week)) { d.setDate(d.getDate() + 1); }
        d.setDate(d.getDate() + (parseInt(nth_occurrence) - 1) * 7);
        const formattedDate = d.toISOString().split('T')[0];

        // ADD DATE TO MAPPING
        const columnValues = item_mapping || {};
        columnValues[process.env.DUE_DATE_COLUMN_ID] = { "date": formattedDate };

        const query = `mutation {
            create_item (
                board_id: ${boardId},
                item_name: "${task_name}",
                column_values: ${JSON.stringify(JSON.stringify(columnValues))}
            ) { id }
        }`;

        await axios.post('https://api.monday.com/v2', { query }, {
            headers: { 'Authorization': process.env.MONDAY_API_TOKEN, 'Content-Type': 'application/json' }
        });

        res.status(200).send({});
    } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed" });
    }
});

app.listen(process.env.PORT || 3000);

const express = require("express");
const path = require("path");

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3003, () => {
      console.log("Server Running at http://localhost:3003/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//User Login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
        SELECT
            *
        FROM
            user
        WHERE
            username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);

  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);

    if (isPasswordMatch === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "aar");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//Authontication Token
const authonticationToken = (request, response, next) => {
  let jwtToken;
  const authHead = request.headers["authorization"];
  if (authHead !== undefined) {
    jwtToken = authHead.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "aar", async (error, user) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

const convertDbToResponse = (dbo) => {
  return {
    stateId: dbo.state_id,
    stateName: dbo.state_name,
    population: dbo.population,
    districtId: dbo.district_id,
    districtName: dbo.district_name,
    cases: dbo.cases,
    cured: dbo.cured,
    active: dbo.active,
    deaths: dbo.deaths,
  };
};

//Get States API

app.get("/states/", authonticationToken, async (request, response) => {
  const selectQuery = `
        SELECT
            *
        FROM
            state;`;
  const getStatesArray = await db.all(selectQuery);
  response.send(getStatesArray.map((each) => convertDbToResponse(each)));
});

//Get State API
app.get("/states/:stateId/", authonticationToken, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `
        SELECT
            *
        FROM
            state
        WHERE
            state_id = ${stateId};`;
  const getState = await db.get(getStateQuery);
  response.send(convertDbToResponse(getState));
});

//Add District API
app.post("/districts/", authonticationToken, async (request, response) => {
  const districtDetails = request.body;
  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;
  const addDistrictQuery = `
    INSERT INTO district (district_name, state_id, cases, cured, active, deaths)
    VALUES
    (
        '${districtName}',
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths}
    );`;
  await db.run(addDistrictQuery);
  response.send("District Successfully Added");
});

//Get District API
app.get(
  "/districts/:districtId/",
  authonticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictDetails = `
        SELECT
            *
        FROM
            district
        WHERE
            district_id = ${districtId};`;
    const districtArray = await db.get(getDistrictDetails);
    response.send(convertDbToResponse(districtArray));
  }
);

// Delete District API
app.delete(
  "/districts/:districtId/",
  authonticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteDistrictQuery = `
        DELETE FROM
            district
        WHERE
            district_id = ${districtId};`;
    await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

//Update District API

app.put(
  "/districts/:districtId/",
  authonticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;
    const updateDistrictQuery = `
        UPDATE district SET
            district_name = '${districtName}',
            state_id = ${stateId},
            cases = ${cases},
            cured = ${cured},
            active = ${active},
            deaths = ${deaths}
        WHERE 
            district_id = ${districtId};`;
    await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

// API 8

app.get(
  "/states/:stateId/stats/",
  authonticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const stateQuery = `
        SELECT
            SUM(cases),
            SUM(cured),
            SUM(active),
            SUM(deaths)
        FROM 
            district
        WHERE
            state_id = ${stateId};`;
    const stateDetails = await db.get(stateQuery);
    response.send({
      totalCases: stateDetails["SUM(cases)"],
      totalCured: stateDetails["SUM(cured)"],
      totalActive: stateDetails["SUM(active)"],
      totalDeaths: stateDetails["SUM(deaths)"],
    });
  }
);

module.exports = app;

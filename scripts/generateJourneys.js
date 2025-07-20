// scripts/generateJourneys.js
import Bus from "../models/Bus.js";
import Journey from "../models/Journey.js";
import connectDB from "../config/db.js"; // Your existing DB connection
import dotenv from "dotenv";
import { addDays, differenceInDays, format, startOfDay } from "date-fns"; // Using date-fns for date logic
import mongoose from "mongoose"; // For closing DB connection if run standalone

// Load environment variables (e.g., for DATABASE_URL)
dotenv.config();

// Helper to format date to YYYY-MM-DD for comparison with unavailableDates
const formatDateForComparison = (date) => {
  return format(date, "yyyy-MM-dd");
};

const generateFutureJourneys = async () => {
  console.log("--- Starting Journey Generation ---");
  let dbConnection; // Declare a variable to hold the database connection

  try {
    // Establish database connection
    dbConnection = await connectDB();

    const today = startOfDay(new Date()); // Get start of today in local timezone
    const lookAheadDays = 60; // Generate journeys for the next 60 days

    const buses = await Bus.find({ isArchived: false }); // Only consider active bus templates

    for (const bus of buses) {
      console.log(`Processing bus: ${bus.name} (ID: ${bus._id})`);

      for (let i = 0; i < lookAheadDays; i++) {
        const targetDate = addDays(today, i); // Calculate target date
        const formattedTargetDate = formatDateForComparison(targetDate);

        // 1. Check bus-level unavailable dates
        if (
          bus.unavailableDates &&
          bus.unavailableDates.includes(formattedTargetDate)
        ) {
          console.log(
            `  Skipping ${formattedTargetDate}: Bus ${bus.name} marked as unavailable.`
          );
          continue; // Skip this date for this bus
        }

        let schedulesForThisDay = [];

        if (bus.isRotatingSchedule) {
          // Validate rotating schedule configuration
          if (
            !bus.rotationStartDate ||
            !bus.rotationCycleLength ||
            bus.rotationSchedulePattern.length === 0
          ) {
            console.warn(
              `  Bus ${bus.name} is marked as rotating but missing 'rotationStartDate', 'rotationCycleLength', or 'rotationSchedulePattern'. Skipping.`
            );
            continue;
          }

          const rotationStart = startOfDay(new Date(bus.rotationStartDate));

          // Ensure targetDate is not before rotationStartDate
          if (targetDate < rotationStart) {
            // console.log(`  Skipping ${formattedTargetDate}: Before rotationStartDate for bus ${bus.name}.`);
            continue;
          }

          // Calculate current day in the rotation cycle
          const daysElapsedSinceStart = differenceInDays(
            targetDate,
            rotationStart
          );
          const currentDayInCycle =
            (daysElapsedSinceStart % bus.rotationCycleLength) + 1; // +1 because dayInCycle starts from 1

          const patternForDay = bus.rotationSchedulePattern.find(
            (pattern) => pattern.dayInCycle === currentDayInCycle
          );

          if (patternForDay) {
            schedulesForThisDay.push(patternForDay);
            console.log(
              `  ${formattedTargetDate}: Found rotating schedule for Day ${currentDayInCycle}.`
            );
          } else {
            console.log(
              `  ${formattedTargetDate}: No rotating schedule pattern found for Day ${currentDayInCycle} for bus ${bus.name}.`
            );
          }
        } else if (
          bus.defaultDailySchedules &&
          bus.defaultDailySchedules.length > 0
        ) {
          schedulesForThisDay = bus.defaultDailySchedules;
          console.log(
            `  ${formattedTargetDate}: Using default daily schedules.`
          );
        } else {
          console.warn(
            `  Bus ${bus.name} has no rotating or default daily schedules defined. Skipping ${formattedTargetDate}.`
          );
          continue;
        }

        for (const schedule of schedulesForThisDay) {
          // Check if journey already exists for this exact bus, date, and departure time
          const existingJourney = await Journey.findOne({
            bus: bus._id,
            journeyDate: targetDate, // Match by exact date (start of day)
            departureTime: schedule.departureTime,
          });

          if (!existingJourney) {
            // Create the new Journey instance
            await Journey.create({
              bus: bus._id,
              journeyDate: targetDate,
              departureTime: schedule.departureTime,
              arrivalTime: schedule.arrivalTime,
              from: bus.from,
              to: bus.to,
              busType: bus.busType,
              seatLayout: bus.seatLayout,
              price: bus.price, // Inherit base price from bus template
              fares: bus.fares, // Inherit default fares from bus template
              boardingPoints: bus.boardingPoints, // Inherit default points
              droppingPoints: bus.droppingPoints, // Inherit default points
              // unavailableSeats defaults to empty array
              // isCanceled defaults to false
            });
            console.log(
              `    SUCCESS: Generated journey for ${bus.name} on ${formattedTargetDate} at ${schedule.departureTime}.`
            );
          } else {
            // console.log(`    SKIP: Journey for ${bus.name} on ${formattedTargetDate} at ${schedule.departureTime} already exists.`);
          }
        }
      }
    }
    console.log("--- Journey Generation Complete ---");
  } catch (error) {
    console.error("--- Error during Journey Generation ---", error);
  } finally {
    // Close database connection if running as a standalone script
    if (dbConnection && mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("Database connection closed.");
    }
  }
};

// This block ensures the function runs when the script is executed directly
// If you integrate with node-cron, you'll call generateFutureJourneys() from there.
if (process.argv[2] === "--run") {
  // Allows running via `node scripts/generateJourneys.js --run`
  generateFutureJourneys();
} else {
  console.log(
    "To run the journey generation, use: node scripts/generateJourneys.js --run"
  );
}

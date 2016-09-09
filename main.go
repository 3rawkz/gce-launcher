package main

import (
	"context"
	"log"

	"cloud.google.com/go/compute/metadata"
	compute "google.golang.org/api/compute/v1"

	"golang.org/x/oauth2/google"
)

func deleteInstance(ctx context.Context) error {
	client, err := google.DefaultClient(ctx, "https://www.googleapis.com/auth/compute")
	if err != nil {
		return err
	}
	computeService, err := compute.New(client)
	if err != nil {
		return err
	}
	instancesService := compute.NewInstancesService(computeService)
	name, err := metadata.InstanceName()
	if err != nil {
		return err
	}
	projectID, err := metadata.ProjectID()
	if err != nil {
		return err
	}
	zone, err := metadata.Zone()
	if err != nil {
		return err
	}
	op, err := instancesService.Delete(projectID, zone, name).Do()
	if err != nil {
		return err
	}
	log.Printf("op %+v", op)
	return nil
}

func main() {
	ctx := context.Background()
	log.Println("Running gce-launcher...")
	if err := deleteInstance(ctx); err != nil {
		log.Fatal(err)
	}
}
